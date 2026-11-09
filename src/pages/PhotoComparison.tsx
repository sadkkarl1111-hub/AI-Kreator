import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { canvasPng, decodeLocalImage, fitImageRect, readLocalDesignImage, saveLocalBlob } from '@/lib/localDesignExport';

const SIDES = [
  { id: 'before', label: 'Przed' },
  { id: 'after', label: 'Po' },
] as const;
type Side = typeof SIDES[number]['id'];

export default function PhotoComparison() {
  const [photos, setPhotos] = useState<Partial<Record<Side, HTMLImageElement>>>({});
  const [position, setPosition] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = Boolean(photos.before && photos.after);

  async function load(side: Side, file: File) {
    setBusy(true);
    setError('');
    try {
      const { dataUrl } = await readLocalDesignImage(file, 1600);
      const image = await decodeLocalImage(dataUrl);
      setPhotos(previous => ({ ...previous, [side]: image }));
      setPosition(50);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nie udało się wczytać zdjęcia.');
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!photos.before || !photos.after) return;
    setBusy(true);
    setError('');
    try {
      const panelWidth = 800;
      const panelHeight = 600;
      const captionHeight = 56;
      const canvas = document.createElement('canvas');
      canvas.width = panelWidth * 2;
      canvas.height = panelHeight + captionHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Brak podglądu płótna.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      SIDES.forEach(({ id, label }, index) => {
        const photo = photos[id]!;
        const rect = fitImageRect(photo.naturalWidth, photo.naturalHeight, panelWidth, panelHeight, 'contain');
        const left = index * panelWidth;
        context.drawImage(photo, left + rect.x, rect.y, rect.width, rect.height);
        context.fillStyle = '#1e293b';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = '600 27px sans-serif';
        context.fillText(label, left + panelWidth / 2, panelHeight + captionHeight / 2);
      });
      context.fillStyle = '#cbd5e1';
      context.fillRect(panelWidth - 1, 0, 2, canvas.height);
      saveLocalBlob(await canvasPng(canvas), 'porownanie-przed-i-po.png');
    } catch {
      setError('Nie udało się zapisać porównania. Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/tools" aria-label="Wróć do narzędzi"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div>
            <h1 className="text-2xl font-bold">Porównanie przed i po</h1>
            <p className="text-pretty text-sm text-muted-foreground">Pokaż efekt retuszu, zmiany tła albo metamorfozy produktu. Zdjęcia pozostają w przeglądarce.</p>
          </div>
        </div>
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {SIDES.map(({ id, label }) => (
                <label key={id} className="grid min-w-0 gap-2 rounded-xl border border-dashed p-4 text-sm font-medium">
                  Zdjęcie „{label}”
                  <input className="w-full" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void load(id, file);
                  }} />
                  <span className="font-normal text-muted-foreground">{photos[id] ? 'Zdjęcie wczytane' : 'PNG, JPG lub WebP do 12 MB'}</span>
                </label>
              ))}
            </div>
            {ready && (
              <div className="space-y-4">
                <div className="relative isolate aspect-[4/3] overflow-hidden rounded-xl border bg-white">
                  <img src={photos.after?.src} alt="Zdjęcie po zmianie" className="absolute inset-0 h-full w-full object-contain" />
                  <img src={photos.before?.src} alt="Zdjęcie przed zmianą" className="absolute inset-0 h-full w-full bg-white object-contain" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-md" style={{ left: `${position}%` }} />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-3 flex justify-between text-sm text-white">
                    {SIDES.map(({ id, label }) => <span key={id} className="rounded bg-black/75 px-2 py-1">{label}</span>)}
                  </div>
                </div>
                <label className="grid gap-1 text-sm font-medium">
                  Suwak porównania
                  <input type="range" min="0" max="100" value={position} onChange={event => setPosition(Number(event.target.value))} className="h-11 w-full accent-primary" />
                </label>
                <Button className="min-h-11 gap-2" disabled={busy} onClick={download}><Download className="h-4 w-4" /> Pobierz oba zdjęcia obok siebie jako PNG</Button>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
