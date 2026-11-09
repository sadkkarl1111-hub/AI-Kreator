import { useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { canvasPng, decodeLocalImage, readLocalDesignImage, saveLocalBlob } from '@/lib/localDesignExport';

type Point = { x: number; y: number };
type Region = { start: Point; end: Point };

function bounds({ start, end }: Region, width: number, height: number) {
  const left = Math.floor(Math.min(start.x, end.x) * width);
  const top = Math.floor(Math.min(start.y, end.y) * height);
  const right = Math.ceil(Math.max(start.x, end.x) * width);
  const bottom = Math.ceil(Math.max(start.y, end.y) * height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export default function PhotoRedaction() {
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [preview, setPreview] = useState<Region | null>(null);
  const [color, setColor] = useState('#000000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<{ pointerId: number; start: Point } | null>(null);
  const width = photo?.naturalWidth ?? 0;
  const height = photo?.naturalHeight ?? 0;

  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      const { dataUrl } = await readLocalDesignImage(file, 2400);
      setPhoto(await decodeLocalImage(dataUrl));
      setRegions([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nie udało się wczytać zdjęcia.');
    } finally {
      setBusy(false);
    }
  }

  function point(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    return { x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) };
  }

  function finish(event: PointerEvent<SVGSVGElement>) {
    const drag = active.current;
    if (drag?.pointerId !== event.pointerId) return;
    const end = point(event);
    const box = event.currentTarget.getBoundingClientRect();
    if (Math.abs(end.x - drag.start.x) * box.width >= 3 && Math.abs(end.y - drag.start.y) * box.height >= 3) {
      setRegions(previous => [...previous, { start: drag.start, end }]);
    }
    active.current = null;
    setPreview(null);
  }

  async function download() {
    if (!photo || !regions.length || busy) return;
    setBusy(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Brak dostępu do płótna.');
      context.drawImage(photo, 0, 0);
      context.fillStyle = color;
      for (const region of regions) {
        const rect = bounds(region, width, height);
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
      saveLocalBlob(await canvasPng(canvas), 'zdjecie-z-zaslonietymi-danymi.png');
    } catch {
      setError('Nie udało się zapisać zdjęcia. Spróbuj ponownie.');
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
            <h1 className="text-2xl font-bold">Zasłoń dane na zdjęciu</h1>
            <p className="text-sm text-muted-foreground">Zakryj adres, numer telefonu lub twarz pełnym kolorem przed udostępnieniem zdjęcia.</p>
          </div>
        </div>
        <Card>
          <CardContent className="space-y-5 pt-6">
            <label className="grid gap-2 rounded-xl border border-dashed p-4 text-sm font-medium">
              {photo ? 'Zmień zdjęcie' : 'Wybierz zdjęcie'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="w-full" disabled={busy || Boolean(preview)} onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void upload(file);
              }} />
              <span className="font-normal text-muted-foreground">PNG, JPG lub WebP do 12 MB. Zdjęcie pozostaje w przeglądarce.</span>
            </label>
            {photo && <>
              <p className="text-sm text-muted-foreground">Przeciągnij po zdjęciu, aby narysować prostokąt. Sprawdź, czy wszystkie dane mieszczą się pod zaznaczeniami.</p>
              <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg ring-1 ring-border">
                <img src={photo.src} alt="Zdjęcie z podglądem zasłoniętych obszarów" className="block h-auto max-h-[70vh] w-auto max-w-full select-none" draggable={false} />
                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
                  onPointerDown={event => {
                    if (busy || active.current || event.button !== 0) return;
                    const start = point(event);
                    active.current = { pointerId: event.pointerId, start };
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setPreview({ start, end: start });
                  }}
                  onPointerMove={event => {
                    if (active.current?.pointerId === event.pointerId) setPreview({ start: active.current.start, end: point(event) });
                  }}
                  onPointerUp={finish}
                  onLostPointerCapture={event => {
                    if (active.current?.pointerId === event.pointerId) {
                      active.current = null;
                      setPreview(null);
                    }
                  }}>
                  {regions.map((region, index) => <rect key={index} {...bounds(region, width, height)} fill={color} />)}
                  {preview && <rect {...bounds(preview, width, height)} fill={color} />}
                </svg>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">Kolor zasłony <input type="color" value={color} disabled={busy} onChange={event => setColor(event.target.value)} /></label>
                <Button variant="outline" disabled={!regions.length || busy || Boolean(preview)} onClick={() => setRegions(previous => previous.slice(0, -1))}>Cofnij ostatnią zasłonę</Button>
                <Button disabled={!regions.length || busy || Boolean(preview)} onClick={download} className="gap-2"><Download className="h-4 w-4" /> Pobierz PNG</Button>
              </div>
              <p className="text-sm text-muted-foreground">{width} × {height} px · Zasłony są częścią pobranego obrazu.</p>
            </>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
