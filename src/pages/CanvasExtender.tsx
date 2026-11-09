import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { LocalSvgTool } from '@/components/LocalSvgTool';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { canvasPng, decodeLocalImage, fitImageRect, readLocalDesignImage, saveLocalBlob } from '@/lib/localDesignExport';

const FORMATS = [
  { name: 'Post kwadratowy', width: 1080, height: 1080 },
  { name: 'Post pionowy', width: 1080, height: 1350 },
  { name: 'Relacja', width: 1080, height: 1920 },
  { name: 'Baner poziomy', width: 1920, height: 1080 },
] as const;
type Background = 'color' | 'blur' | 'transparent';

export default function CanvasExtender() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [formatIndex, setFormatIndex] = useState(0);
  const [background, setBackground] = useState<Background>('color');
  const [color, setColor] = useState('#ffffff');
  const [margin, setMargin] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = FORMATS[formatIndex];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    if (background !== 'transparent') {
      context.fillStyle = background === 'color' ? color : '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    if (background === 'blur') {
      const overscan = 88;
      const backdrop = fitImageRect(image.naturalWidth, image.naturalHeight, width + overscan * 2, height + overscan * 2, 'cover');
      context.filter = 'blur(35px)';
      context.drawImage(image, backdrop.x - overscan, backdrop.y - overscan, backdrop.width, backdrop.height);
      context.filter = 'none';
    }
    const inset = Math.round(Math.min(width, height) * margin / 100);
    const photo = fitImageRect(image.naturalWidth, image.naturalHeight, width - 2 * inset, height - 2 * inset, 'contain');
    context.drawImage(image, photo.x + inset, photo.y + inset, photo.width, photo.height);
  }, [image, width, height, background, color, margin]);

  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      const { dataUrl } = await readLocalDesignImage(file, 2400);
      setImage(await decodeLocalImage(dataUrl));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nie udało się wczytać zdjęcia.');
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    setError('');
    try {
      saveLocalBlob(await canvasPng(canvas), `zdjecie-${width}x${height}.png`);
    } catch {
      setError('Nie udało się zapisać PNG. Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

  return <LocalSvgTool title="Rozszerzanie płótna zdjęcia" description="Dopasuj zdjęcie do posta, relacji lub banera. Całe zdjęcie pozostaje widoczne.">
    <Card><CardContent className="space-y-5 pt-6">
      <label className="grid gap-2 rounded-xl border border-dashed p-4 text-sm font-medium">
        Wybierz zdjęcie
        <input className="w-full" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void upload(file);
        }} />
        <span className="font-normal text-muted-foreground">PNG, JPG lub WebP do 12 MB. Plik pozostaje w przeglądarce.</span>
      </label>
      {image && <>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">Format wynikowy
            <select className="min-h-11 rounded-md border bg-background px-3" value={formatIndex} onChange={event => setFormatIndex(Number(event.target.value))}>
              {FORMATS.map((format, index) => <option key={format.name} value={index}>{format.name} · {format.width} × {format.height}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">Wypełnienie
            <select className="min-h-11 rounded-md border bg-background px-3" value={background} onChange={event => setBackground(event.target.value as Background)}>
              <option value="color">Jednolity kolor</option>
              <option value="blur">Rozmyte zdjęcie</option>
              <option value="transparent">Przezroczystość</option>
            </select>
          </label>
          {background === 'color' && <label className="flex items-center gap-3 text-sm font-medium">Kolor tła <input type="color" className="h-11 w-14" value={color} onChange={event => setColor(event.target.value)} /></label>}
          <label className="grid gap-2 text-sm font-medium">Margines · {margin}%
            <input className="h-9 accent-primary" type="range" min="0" max="25" value={margin} onChange={event => setMargin(Number(event.target.value))} />
          </label>
        </fieldset>
        <div className="overflow-hidden rounded-lg border bg-muted/40 p-3">
          <canvas ref={canvasRef} role="img" aria-label="Podgląd zdjęcia na rozszerzonym płótnie" className="mx-auto block max-h-[60vh] max-w-full object-contain" />
        </div>
        <Button onClick={download} disabled={busy} className="gap-2"><Download className="h-4 w-4" /> Pobierz PNG {width} × {height}</Button>
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent></Card>
  </LocalSvgTool>;
}
