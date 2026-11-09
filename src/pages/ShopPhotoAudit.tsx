import { useState } from 'react';
import { LocalSvgTool } from '@/components/LocalSvgTool';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { decodeLocalImage } from '@/lib/localDesignExport';

type Photo = { name: string; size: number; width: number; height: number; error?: string };
const MAX_FILES = 30;

export default function ShopPhotoAudit() {
  const [files, setFiles] = useState<File[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [minWidth, setMinWidth] = useState('1000');
  const [minHeight, setMinHeight] = useState('1000');
  const [maxSize, setMaxSize] = useState('2048');
  const [ratio, setRatio] = useState('1:1');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const ratioMatch = /^([1-9]\d{0,2}):([1-9]\d{0,2})$/.exec(ratio.trim());
  const targetRatio = ratioMatch ? Number(ratioMatch[1]) / Number(ratioMatch[2]) : null;
  const rulesValid = [minWidth, minHeight, maxSize].every(value => value.trim() && Number.isSafeInteger(Number(value)) && Number(value) > 0) && (!ratio.trim() || targetRatio !== null);
  const busy = progress !== null;

  const results = rulesValid ? photos.map(photo => {
    const problems: string[] = [];
    if (photo.error) problems.push(photo.error);
    else {
      if (photo.width < Number(minWidth) || photo.height < Number(minHeight)) problems.push(`Za małe wymiary · minimum ${minWidth} × ${minHeight} px`);
      if (targetRatio && Math.abs(photo.width / photo.height / targetRatio - 1) > 0.01) problems.push(`Inne proporcje niż ${ratio.trim()}`);
    }
    if (photo.size > Number(maxSize) * 1024) problems.push(`Za duży plik · limit ${maxSize} KB`);
    return { ...photo, problems };
  }) : [];

  async function scan() {
    if (busy || !files.length || !rulesValid) return;
    setPhotos([]);
    setProgress(0);
    const scanned: Photo[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const url = URL.createObjectURL(file);
        try {
          const image = await decodeLocalImage(url);
          scanned.push({ name: file.name, size: file.size, width: image.naturalWidth, height: image.naturalHeight });
        } catch {
          scanned.push({ name: file.name, size: file.size, width: 0, height: 0, error: 'Nie można odczytać zdjęcia' });
        } finally {
          URL.revokeObjectURL(url);
        }
        setProgress(index + 1);
      }
      setPhotos(scanned);
    } finally {
      setProgress(null);
    }
  }

  return <LocalSvgTool title="Kontrola zdjęć do sklepu" description="Ustaw wymagania swojego sklepu i sprawdź, które zdjęcia trzeba poprawić przed publikacją.">
    <Card><CardContent className="space-y-5 pt-6">
      <label className="grid gap-2 rounded-xl border border-dashed p-4 text-sm font-medium">
        Wybierz paczkę zdjęć
        <input className="w-full" type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => {
          const selected = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (!selected.length) return;
          setPhotos([]);
          const supported = selected.filter(file => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && file.size <= 25 * 1024 * 1024);
          const accepted = supported.slice(0, MAX_FILES);
          setFiles(accepted);
          const skipped = selected.length - accepted.length;
          setError(skipped ? `Pominięto pliki: ${skipped}. Limit to ${MAX_FILES} zdjęć PNG, JPG lub WebP do 25 MB każde.` : '');
        }} />
        <span className="font-normal text-muted-foreground">Do 30 plików · analiza na Twoim urządzeniu. Wybrano {files.length}.</span>
      </label>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-medium">Min. szerokość (px)
          <input className="min-h-11 min-w-0 rounded-md border bg-background px-3" type="number" min="1" value={minWidth} onChange={event => setMinWidth(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium">Min. wysokość (px)
          <input className="min-h-11 min-w-0 rounded-md border bg-background px-3" type="number" min="1" value={minHeight} onChange={event => setMinHeight(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium">Maks. rozmiar pliku (KB)
          <input className="min-h-11 min-w-0 rounded-md border bg-background px-3" type="number" min="1" value={maxSize} onChange={event => setMaxSize(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-medium">Proporcje zdjęcia
          <input className="min-h-11 min-w-0 rounded-md border bg-background px-3" maxLength={7} placeholder="np. 4:5" value={ratio} onChange={event => setRatio(event.target.value)} />
        </label>
      </fieldset>
      <p className="text-sm text-muted-foreground">Proporcje podaj jako szerokość:wysokość. Puste pole pomija tę regułę. Tolerancja wynosi 1%.</p>
      {!rulesValid && <p role="alert" className="text-sm text-destructive">Wpisz dodatnie liczby całkowite i proporcje w formacie np. 4:5.</p>}
      {error && <p role="status" className="text-sm text-muted-foreground">{error}</p>}
      <Button onClick={scan} disabled={busy || !files.length || !rulesValid}>Sprawdź zdjęcia</Button>
      {busy && <p role="status" className="text-sm">Sprawdzono {progress} z {files.length} zdjęć…</p>}
      {results.length > 0 && <section aria-label="Wyniki kontroli" className="space-y-3">
        <p role="status" className="text-sm font-medium">Zgodne {results.filter(photo => !photo.problems.length).length} z {results.length} zdjęć</p>
        <ul className="space-y-2">
          {results.map((photo, index) => <li key={index} className="space-y-1 rounded-lg border p-3 text-sm">
            <p className="break-all font-medium">{photo.name}</p>
            <p className="text-muted-foreground">{photo.width > 0 && `${photo.width} × ${photo.height} px · `}{(photo.size / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} KB</p>
            {photo.problems.length ? <ul className="list-inside list-disc text-destructive">{photo.problems.map(problem => <li key={problem}>{problem}</li>)}</ul> : <p className="text-emerald-700 dark:text-emerald-300">Spełnia wymagania</p>}
          </li>)}
        </ul>
      </section>}
    </CardContent></Card>
  </LocalSvgTool>;
}
