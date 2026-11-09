import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Download, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { decodeLocalImage, fitImageRect, readLocalDesignImage, saveLocalBlob } from '@/lib/localDesignExport';

const MAX_FRAMES = 12;
const MAX_EDGE = 640;
type Frame = { id: number; name: string; image: HTMLImageElement };

async function encodeGif(frames: Frame[], delay: number, progress: (frame: number) => void) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const first = frames[0].image;
  const width = first.naturalWidth;
  const height = first.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Nie udało się przygotować GIF-a.');
  const encoder = GIFEncoder();

  for (const [index, frame] of frames.entries()) {
    const rect = fitImageRect(frame.image.naturalWidth, frame.image.naturalHeight, width, height, 'contain');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(frame.image, rect.x, rect.y, rect.width, rect.height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const palette = quantize(pixels, 256, { format: 'rgb565' });
    encoder.writeFrame(applyPalette(pixels, palette), width, height, { palette, delay, repeat: 0 });
    progress(index + 1);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  encoder.finish();
  return new Blob([encoder.bytes()], { type: 'image/gif' });
}

export default function PhotoGifMaker() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [delay, setDelay] = useState(500);
  const [gif, setGif] = useState<{ blob: Blob; url: string } | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const nextFrameId = useRef(0);

  useEffect(() => {
    if (!gif) return;
    return () => URL.revokeObjectURL(gif.url);
  }, [gif]);

  async function addFiles(files: File[]) {
    setError('');
    if (frames.length + files.length > MAX_FRAMES) {
      setError(`GIF może mieć do ${MAX_FRAMES} zdjęć. Masz jeszcze ${MAX_FRAMES - frames.length} wolnych miejsc.`);
      return;
    }
    setStatus('Wczytuję zdjęcia…');
    try {
      const added: Frame[] = [];
      for (const file of files) {
        const { dataUrl } = await readLocalDesignImage(file, MAX_EDGE);
        added.push({ id: nextFrameId.current++, name: file.name, image: await decodeLocalImage(dataUrl) });
      }
      setFrames(previous => [...previous, ...added]);
      setGif(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nie udało się wczytać zdjęć.');
    } finally {
      setStatus('');
    }
  }

  function moveFrame(index: number, direction: -1 | 1) {
    const next = [...frames];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setFrames(next);
    setGif(null);
  }

  async function createGif() {
    setError('');
    setStatus('Przygotowuję animację…');
    try {
      const blob = await encodeGif(frames, delay, frame => setStatus(`Zapisuję klatkę ${frame} z ${frames.length}…`));
      setShowPreview(true);
      setGif({ blob, url: URL.createObjectURL(blob) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nie udało się utworzyć GIF-a.');
    } finally {
      setStatus('');
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/tools" aria-label="Wróć do narzędzi"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div>
            <h1 className="text-2xl font-bold">Kreator GIF ze zdjęć</h1>
            <p className="text-sm text-muted-foreground">Ułóż zdjęcia w kolejności, ustaw tempo i zapisz zapętloną animację.</p>
          </div>
        </div>
        <Card>
          <CardContent className="space-y-5 pt-6">
            <label className="grid gap-2 rounded-xl border border-dashed p-4 text-sm font-medium">
              Dodaj zdjęcia
              <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="w-full" disabled={Boolean(status) || frames.length >= MAX_FRAMES} onChange={event => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                if (files.length) void addFiles(files);
              }} />
              <span className="font-normal text-muted-foreground">Od 2 do 12 zdjęć PNG, JPG lub WebP do 12 MB każde. Pliki pozostają w przeglądarce.</span>
            </label>
            {frames.length > 0 && <>
              <ol className="space-y-2" aria-label="Kolejność klatek">
                {frames.map((frame, index) => (
                  <li key={frame.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                    <img src={frame.image.src} alt="" className="h-12 w-12 shrink-0 rounded bg-muted object-contain" />
                    <span className="min-w-0 flex-1 break-all text-sm">{index + 1}. {frame.name}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" disabled={Boolean(status) || index === 0} onClick={() => moveFrame(index, -1)} aria-label={`Przesuń klatkę ${index + 1} wyżej`}><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={Boolean(status) || index === frames.length - 1} onClick={() => moveFrame(index, 1)} aria-label={`Przesuń klatkę ${index + 1} niżej`}><ArrowDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={Boolean(status)} onClick={() => {
                        setFrames(previous => previous.filter(item => item.id !== frame.id));
                        setGif(null);
                      }} aria-label={`Usuń klatkę ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                ))}
              </ol>
              <label className="grid gap-2 text-sm font-medium">Czas wyświetlania klatki
                <select className="min-h-11 rounded-md border bg-background px-3 sm:w-56" disabled={Boolean(status)} value={delay} onChange={event => {
                  setDelay(Number(event.target.value));
                  setGif(null);
                }}>
                  <option value={200}>0,2 sekundy</option>
                  <option value={500}>0,5 sekundy</option>
                  <option value={1000}>1 sekunda</option>
                  <option value={1500}>1,5 sekundy</option>
                  <option value={2000}>2 sekundy</option>
                </select>
              </label>
              <p className="text-sm text-muted-foreground">Pierwsze zdjęcie ustala proporcje GIF-a. Pozostałe klatki dopasują się na białym tle. Maksymalny bok to 640 px.</p>
              <Button className="min-h-11" disabled={Boolean(status) || frames.length < 2} onClick={createGif}>Utwórz GIF</Button>
            </>}
            {status && <p role="status" className="text-sm">{status}</p>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {gif && <section className="space-y-3" aria-label="Gotowa animacja">
              {showPreview && <img src={gif.url} alt="Podgląd gotowego GIF-a" className="max-h-96 max-w-full rounded-lg border" />}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setShowPreview(previous => !previous)}>{showPreview ? 'Zatrzymaj podgląd' : 'Pokaż podgląd'}</Button>
                <Button className="gap-2" onClick={() => saveLocalBlob(gif.blob, 'animacja-ze-zdjec.gif')}><Download className="h-4 w-4" /> Pobierz GIF</Button>
              </div>
            </section>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
