import { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Monitor, Upload, ArrowLeft, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MOCKUPS, MOCKUP_CATEGORIES, type MockupTemplate } from '@/components/mockup/mockupTemplates';
import { canvasPng, decodeLocalImage, fitImageRect, saveLocalBlob } from '@/lib/localDesignExport';
import { drawStudioMockup, hasStudioMockup, STUDIO_BACKGROUNDS, studioViewsFor, type StudioBackground, type StudioView } from '@/lib/mockupStudio';

type ImageFit = 'contain' | 'cover' | 'stretch';

function drawMockup(canvas: HTMLCanvasElement, template: MockupTemplate, image: HTMLImageElement | null, fit: ImageFit, view: StudioView, background: StudioBackground) {
  if (hasStudioMockup(template.id)) {
    drawStudioMockup(canvas, template.id, image, fit, view, background);
    return;
  }
  const { canvasW, canvasH, bgColor, imageArea, draw, drawOverlay } = template;
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Nie udało się przygotować mockupu.');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvasW, canvasH);
  draw(ctx, canvasW, canvasH);

  if (image) {
    const rect = fit === 'stretch'
      ? { x: 0, y: 0, width: imageArea.w, height: imageArea.h }
      : fitImageRect(image.naturalWidth, image.naturalHeight, imageArea.w, imageArea.h, fit);
    ctx.save();
    ctx.beginPath();
    ctx.rect(imageArea.x, imageArea.y, imageArea.w, imageArea.h);
    ctx.clip();
    ctx.drawImage(image, imageArea.x + rect.x, imageArea.y + rect.y, rect.width, rect.height);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(200,200,200,0.3)';
    ctx.fillRect(imageArea.x, imageArea.y, imageArea.w, imageArea.h);
    ctx.fillStyle = '#999';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Twoja grafika tutaj', imageArea.x + imageArea.w / 2, imageArea.y + imageArea.h / 2);
  }
  drawOverlay?.(ctx, canvasW, canvasH);
}

const MockupGenerator = () => {
  const [selectedMockup, setSelectedMockup] = useState(MOCKUPS[0]);
  const [userImage, setUserImage] = useState<HTMLImageElement | null>(null);
  const [fit, setFit] = useState<ImageFit>('contain');
  const [view, setView] = useState<StudioView>('right');
  const [background, setBackground] = useState<StudioBackground>('light');
  const [allViews, setAllViews] = useState(false);
  const [reading, setReading] = useState(false);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [packedCount, setPackedCount] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const packing = packedCount !== null;
  const locked = reading || packing;
  const studio = hasStudioMockup(selectedMockup.id);
  const availableViews = studioViewsFor(selectedMockup.id);
  const activeView = availableViews.find(option => option.id === view)?.id ?? availableViews[0].id;
  const selectedBatch = MOCKUPS.filter(template => batchIds.includes(template.id));
  const hasStudioInBatch = selectedBatch.some(template => hasStudioMockup(template.id));
  const batchSize = selectedBatch.reduce((total, template) => total + (allViews && hasStudioMockup(template.id) ? studioViewsFor(template.id).length : 1), 0);

  const handleFile = async (file: File) => {
    setReading(true);
    const url = URL.createObjectURL(file);
    try {
      setUserImage(await decodeLocalImage(url));
    } catch {
      toast.error('Nie udało się wczytać grafiki. Wybierz inny plik.');
    } finally {
      URL.revokeObjectURL(url);
      setReading(false);
    }
  };

  useEffect(() => {
    if (canvasRef.current) drawMockup(canvasRef.current, selectedMockup, userImage, fit, activeView, background);
  }, [selectedMockup, userImage, fit, activeView, background]);

  const download = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `mockup-${selectedMockup.id}${studio ? `-${activeView}` : ''}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    toast.success('Mockup pobrany!');
  };

  async function downloadBatch() {
    if (!userImage || locked || !batchIds.length) return;
    const canvas = document.createElement('canvas');
    setPackedCount(0);
    try {
      const { zipSync } = await import('fflate');
      const files: Record<string, Uint8Array> = {};
      let completed = 0;
      for (const template of selectedBatch) {
        const isStudio = hasStudioMockup(template.id);
        const supported = studioViewsFor(template.id);
        const defaultAngle = supported.find(option => option.id === activeView)?.id ?? supported[0].id;
        const views = isStudio && allViews ? supported.map(option => option.id) : [defaultAngle];
        for (const angle of views) {
          drawMockup(canvas, template, userImage, fit, angle, background);
          const png = await canvasPng(canvas);
          files[`mockup-${template.id}${isStudio ? `-${angle}` : ''}.png`] = new Uint8Array(await png.arrayBuffer());
          setPackedCount(++completed);
        }
      }
      saveLocalBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), 'paczka-mockupow.zip');
      toast.success(`Paczka jest gotowa · ${completed} plików PNG.`);
    } catch {
      toast.error('Nie udało się przygotować paczki. Spróbuj ponownie.');
    } finally {
      canvas.width = 1;
      canvas.height = 1;
      setPackedCount(null);
    }
  }

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Monitor className="w-6 h-6 text-primary" /> Generator mockupów</h1>
            <p className="text-sm text-muted-foreground">Pokaż swoją grafikę na urządzeniu, opakowaniu lub produkcie.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <input ref={fileInputRef} type="file" accept="image/*" aria-label="Wgraj grafikę do mockupów" className="hidden" disabled={locked} onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void handleFile(file);
            }} />

            <Button variant="outline" className="gap-2" disabled={locked} onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4" /> {reading ? 'Wczytuję grafikę…' : userImage ? 'Zmień grafikę' : 'Wgraj grafikę'}
            </Button>
            {userImage && <label className="grid gap-2 text-sm font-medium sm:max-w-xs">
              Dopasowanie grafiki
              <select value={fit} disabled={locked} onChange={event => setFit(event.target.value as ImageFit)} className="min-h-11 rounded-md border bg-background px-3">
                <option value="contain">Cała grafika</option>
                <option value="cover">Wypełnij ramkę</option>
                <option value="stretch">Rozciągnij do ramki</option>
              </select>
            </label>}

            {/* Mockup selection by category */}
            <div className="space-y-3">
              {MOCKUP_CATEGORIES.map(cat => {
                const items = MOCKUPS.filter(m => m.category === cat);
                return (
                  <div key={cat}>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{cat}</label>
                    <div className="flex flex-wrap gap-2">
                      {items.map(m => (
                        <Button
                          key={m.id}
                          size="sm"
                          variant={selectedMockup.id === m.id ? 'default' : 'outline'}
                          aria-pressed={selectedMockup.id === m.id}
                          onClick={() => setSelectedMockup(m)}
                          className="text-xs"
                        >
                          {m.label}{hasStudioMockup(m.id) && !m.label.endsWith('3D') && <span className="ml-1 text-xs opacity-75">3D</span>}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {studio && <fieldset disabled={locked} className="space-y-3 rounded-xl border p-4">
              <legend className="px-2 text-sm font-semibold">Ujęcie w studiu 3D</legend>
              <div className="flex flex-wrap gap-2">
                {availableViews.map(option => <Button key={option.id} size="sm" variant={activeView === option.id ? 'default' : 'outline'} aria-pressed={activeView === option.id} onClick={() => setView(option.id)}>{option.label}</Button>)}
              </div>
              <label className="grid gap-2 text-sm font-medium sm:max-w-xs">
                Tło studia
                <select className="min-h-11 rounded-md border bg-background px-3" value={background} onChange={event => setBackground(event.target.value as StudioBackground)}>
                  {Object.entries(STUDIO_BACKGROUNDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
            </fieldset>}
            <canvas ref={canvasRef} role="img" aria-label={`Podgląd mockupu: ${selectedMockup.label}`} className="mx-auto block h-auto max-h-[620px] max-w-full rounded-xl border bg-muted object-contain" />

            <Button onClick={download} disabled={locked} className="gap-2"><Download className="w-4 h-4" /> Pobierz mockup</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <h2 className="text-lg font-semibold">Paczka mockupów</h2>
              <p className="text-sm text-muted-foreground">Wybierz nośniki dla tej samej grafiki. Modele 3D użyją wybranego ujęcia i tła studia.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" disabled={locked || batchIds.length === MOCKUPS.length} onClick={() => setBatchIds(MOCKUPS.map(template => template.id))}>Zaznacz wszystkie</Button>
              <Button variant="ghost" size="sm" disabled={locked || !batchIds.length} onClick={() => setBatchIds([])}>Wyczyść wybór</Button>
              <span className="text-sm text-muted-foreground">Wybrano {batchIds.length} z {MOCKUPS.length}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MOCKUP_CATEGORIES.map(category => (
                <fieldset key={category} disabled={locked} className="space-y-1">
                  <legend className="mb-1 text-sm font-medium">{category}</legend>
                  {MOCKUPS.filter(template => template.category === category).map(template => (
                    <label key={template.id} className="flex min-h-10 items-center gap-2 text-sm">
                      <input type="checkbox" checked={batchIds.includes(template.id)} className="size-4 accent-primary" onChange={event => {
                        const checked = event.target.checked;
                        setBatchIds(previous => checked ? [...previous, template.id] : previous.filter(id => id !== template.id));
                      }} />
                      {template.label}
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            {hasStudioInBatch && <label className="flex min-h-10 items-center gap-2 text-sm">
              <input type="checkbox" checked={allViews} className="size-4 accent-primary" disabled={locked} onChange={event => setAllViews(event.target.checked)} />
              Dodaj wszystkie ujęcia modeli 3D
            </label>}
            <Button onClick={downloadBatch} disabled={locked || !userImage || !batchIds.length} className="gap-2">
              <Download className="h-4 w-4" /> Pobierz paczkę ZIP{batchSize ? ` · ${batchSize} PNG` : ''}
            </Button>
            {!userImage && <p className="text-sm text-muted-foreground">Wgraj grafikę u góry, aby pobrać paczkę.</p>}
            {packing && <p role="status" className="text-sm text-muted-foreground">Przygotowuję mockupy · {packedCount} z {batchSize}</p>}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default MockupGenerator;
