import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAiModels } from '@/hooks/useAiModels';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { canvasPng, decodeLocalImage, saveLocalBlob } from '@/lib/localDesignExport';
import { loadImageFromUrlAsDataUrl } from '@/lib/toolImage';
import { vpsFetch } from '@/lib/vpsApi';
import { PANORAMA_FORMATS, panoramaCrop } from '@/lib/carouselPanorama';

type Action = 'upload' | 'ai' | 'export';

function PanoramaAi({ busy, onGenerate }: { busy: boolean; onGenerate: (model: string, price: number) => Promise<void> }) {
  const { aiModels, selectedModel, selectedModelOption, setSelectedModel, loading: modelsLoading } = useAiModels({ purpose: 'editing' });
  const { balance, isAdmin, loading: creditsLoading, refetch } = useCredits();
  const price = selectedModelOption?.cost || 50;
  const canAfford = isAdmin === true || (balance ?? 0) >= price;

  async function generate() {
    try {
      await onGenerate(selectedModel, price);
    } finally {
      await refetch();
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <h2 className="font-semibold">Poszerz zdjęcie z AI</h2>
      <p className="text-sm text-muted-foreground">AI przygotuje szerszą wersję zdjęcia. Potem możesz ponownie ustawić kadr. Przy dłuższych karuzelach najlepiej sprawdzi się szeroka panorama źródłowa.</p>
      {aiModels.length > 0 && <label className="grid gap-2 text-sm font-medium">
        Model AI
        <select className="min-h-11 w-full rounded-md border bg-background px-3 sm:w-64" value={selectedModel} onChange={event => setSelectedModel(event.target.value)} disabled={busy}>
          {aiModels.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
      </label>}
      {modelsLoading || creditsLoading ? <p role="status" className="text-sm">Sprawdzam dostępność AI…</p> : (
        <p className="text-sm text-muted-foreground">
          {!selectedModelOption ? 'Obecnie nie ma dostępnego modelu AI.' : isAdmin ? 'Generowanie na koncie administratora' : `Koszt ${price} kredytów · saldo ${balance ?? 0}${canAfford ? '' : ' · za mało kredytów'}`}
        </p>
      )}
      <Button variant="outline" className="min-h-11 gap-2" disabled={busy || modelsLoading || creditsLoading || !selectedModelOption || !canAfford} onClick={generate}>
        <Sparkles className="h-4 w-4" /> Poszerz zdjęcie
      </Button>
    </div>
  );
}

export default function CarouselPanorama() {
  const { user } = useAuth();
  const [original, setOriginal] = useState<HTMLImageElement | null>(null);
  const [expanded, setExpanded] = useState<HTMLImageElement | null>(null);
  const [useExpanded, setUseExpanded] = useState(false);
  const [count, setCount] = useState(2);
  const [formatIndex, setFormatIndex] = useState(0);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  const [action, setAction] = useState<Action | null>(null);
  const [error, setError] = useState('');
  const image = (useExpanded ? expanded : original) ?? original;
  const { width, height } = PANORAMA_FORMATS[formatIndex];
  const stripWidth = width * count;
  const crop = image ? panoramaCrop(image.naturalWidth, image.naturalHeight, stripWidth, height, horizontal, vertical) : null;

  useEffect(() => {
    if (!original) return;
    return () => URL.revokeObjectURL(original.src);
  }, [original]);

  async function upload(file: File) {
    setAction('upload');
    setError('');
    const url = URL.createObjectURL(file);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
        throw new Error('Wybierz zdjęcie PNG, JPG lub WebP do 20 MB.');
      }
      const loaded = await decodeLocalImage(url);
      if (loaded.naturalWidth * loaded.naturalHeight > 40_000_000) throw new Error('Zdjęcie może mieć do 40 megapikseli.');
      setOriginal(loaded);
      setExpanded(null);
      setUseExpanded(false);
      setHorizontal(50);
      setVertical(50);
    } catch (reason) {
      URL.revokeObjectURL(url);
      setError(reason instanceof Error ? reason.message : 'Nie udało się wczytać zdjęcia.');
    } finally {
      setAction(null);
    }
  }

  async function expand(model: string, expectedCreditCost: number) {
    if (!original || action) return;
    setAction('ai');
    setError('');
    try {
      const input = document.createElement('canvas');
      const scale = Math.min(1, 1600 / Math.max(original.naturalWidth, original.naturalHeight));
      input.width = Math.max(1, Math.round(original.naturalWidth * scale));
      input.height = Math.max(1, Math.round(original.naturalHeight * scale));
      const context = input.getContext('2d');
      if (!context) throw new Error('Nie udało się przygotować zdjęcia.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, input.width, input.height);
      context.drawImage(original, 0, 0, input.width, input.height);
      const result = await vpsFetch<{ imageUrl?: string }>('/ai/edit-image', {
        method: 'POST',
        body: JSON.stringify({
          model,
          expectedCreditCost,
          toolId: 'carousel-panorama',
          dimensions: '1920x1080',
          imageMimeType: 'image/jpeg',
          imageBase64: input.toDataURL('image/jpeg', 0.9).split(',')[1],
          prompt: 'Outpaint the supplied photo horizontally on both the left and right for a seamless wide landscape panorama. Keep the original subject fully visible, recognizable and centered, preserving proportions, branding and details. Extend the surrounding scene naturally with matching perspective, light and textures. Keep important details near the horizontal center line so the result can be cropped into adjacent portrait slides. Return one continuous photograph with no panels, borders, dividers or added text.',
        }),
      });
      if (!result.imageUrl) throw new Error('Model nie zwrócił zdjęcia. Spróbuj ponownie.');
      const source = await loadImageFromUrlAsDataUrl(result.imageUrl);
      setExpanded(await decodeLocalImage(source.dataUrl));
      setUseExpanded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nie udało się poszerzyć zdjęcia.');
    } finally {
      setAction(null);
    }
  }

  async function download() {
    if (!image || !crop || action) return;
    setAction('export');
    setError('');
    try {
      const { zipSync } = await import('fflate');
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Nie udało się przygotować slajdów.');
      const files: Record<string, Uint8Array> = {};
      for (let slide = 0; slide < count; slide++) {
        context.clearRect(0, 0, width, height);
        context.drawImage(image, crop.x - slide * width, crop.y, crop.width, crop.height);
        const png = await canvasPng(canvas);
        files[`slajd-${String(slide + 1).padStart(2, '0')}.png`] = new Uint8Array(await png.arrayBuffer());
      }
      saveLocalBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), 'karuzela-panoramiczna.zip');
    } catch {
      setError('Nie udało się zapisać slajdów. Spróbuj ponownie.');
    } finally {
      setAction(null);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/tools" aria-label="Wróć do narzędzi"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div>
            <h1 className="text-balance text-2xl font-bold">Karuzela z jednego zdjęcia</h1>
            <p className="text-pretty text-sm text-muted-foreground">Przytnij panoramę do kilku slajdów, które po przesunięciu tworzą jeden ciągły obraz.</p>
          </div>
        </div>
        <Card>
          <CardContent className="space-y-5 pt-6">
            <label className="grid gap-2 rounded-xl border border-dashed p-4 text-sm font-medium">
              {original ? 'Zmień zdjęcie' : 'Wybierz zdjęcie'}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={action !== null} className="w-full" onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void upload(file);
              }} />
              <span className="font-normal text-muted-foreground">PNG, JPG lub WebP do 20 MB. Cięcie i eksport są darmowe.</span>
            </label>
            {image && <>
              <fieldset disabled={action !== null} className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">Liczba slajdów
                  <select className="min-h-11 rounded-md border bg-background px-3" value={count} onChange={event => setCount(Number(event.target.value))}>
                    {[2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">Format slajdu
                  <select className="min-h-11 rounded-md border bg-background px-3" value={formatIndex} onChange={event => setFormatIndex(Number(event.target.value))}>
                    {PANORAMA_FORMATS.map((format, index) => <option key={format.label} value={index}>{format.label}</option>)}
                  </select>
                </label>
                {crop && crop.width > stripWidth + 0.01 && <label className="grid gap-2 text-sm">Przesunięcie kadru w poziomie
                  <input type="range" min="0" max="100" value={horizontal} onChange={event => setHorizontal(Number(event.target.value))} />
                </label>}
                {crop && crop.height > height + 0.01 && <label className="grid gap-2 text-sm">Przesunięcie kadru w pionie
                  <input type="range" min="0" max="100" value={vertical} onChange={event => setVertical(Number(event.target.value))} />
                </label>}
              </fieldset>
              {expanded && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useExpanded} disabled={action !== null} onChange={event => setUseExpanded(event.target.checked)} /> Użyj zdjęcia poszerzonego przez AI</label>}
              <div className="space-y-2">
                <div className="relative isolate overflow-hidden rounded-lg border bg-muted" style={{ aspectRatio: `${stripWidth} / ${height}` }}>
                  <img src={image.src} alt="Podgląd podziału zdjęcia na slajdy" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${horizontal}% ${vertical}%` }} />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
                    {Array.from({ length: count }, (_, index) => <div key={index} className="border-r border-dashed border-white last:border-0"><span className="m-1 inline-block rounded bg-black/75 px-2 py-0.5 text-xs text-white">{index + 1}</span></div>)}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Każdy slajd ma {width} × {height} px. Publikuj w kolejności od 01. Linie podziału służą do podglądu.</p>
              </div>
              <Button className="min-h-11 gap-2" disabled={action !== null} onClick={download}><Download className="h-4 w-4" /> Pobierz slajdy ZIP</Button>
              {user
                ? <PanoramaAi busy={action !== null} onGenerate={expand} />
                : <p className="text-sm text-muted-foreground">Zdjęcie jest za wąskie? <Link className="text-primary underline" to="/auth?returnTo=%2Ftools%2Fcarousel-panorama">Zaloguj się, aby poszerzyć je z AI</Link>. Po zalogowaniu wczytaj zdjęcie ponownie.</p>}
            </>}
            {action && <p role="status" className="text-sm">{action === 'ai' ? 'AI poszerza zdjęcie…' : action === 'export' ? 'Przygotowuję plik ZIP…' : 'Wczytuję zdjęcie…'}</p>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
