import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { LocalSvgPreview, LocalSvgTool } from '@/components/LocalSvgTool';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { defaultVectorOptions, traceDimensions, type VectorOptions, type VectorRequest, type VectorResult } from '@/lib/vectorize';

type SourceImage = { url: string; name: string; width: number; height: number };
type SavedVector = VectorResult & { settings: string; sourceUrl: string };
const signature = (options: VectorOptions) => JSON.stringify(options);

export default function ImageVectorizer() {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [options, setOptions] = useState(defaultVectorOptions);
  const [result, setResult] = useState<SavedVector | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const worker = useRef<Worker | null>(null);
  const job = useRef(0);
  const uploadJob = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceUrl = useRef('');
  const preview = useRef<HTMLDivElement>(null);
  const change = <K extends keyof VectorOptions>(key: K, value: VectorOptions[K]) => setOptions(previous => ({ ...previous, [key]: value }));
  const stop = () => {
    job.current++;
    worker.current?.terminate(); worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => { stop(); uploadJob.current++; if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current); }, []);

  const upload = async (file?: File) => {
    if (!file) return;
    stop(); setBusy(false); setLoading(true); setError(''); setNotice('');
    const uploadId = ++uploadJob.current;
    let nextUrl = '';
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Wybierz obraz PNG, JPG lub WebP.');
      if (file.size > 12 * 1024 * 1024) throw new Error('Plik może mieć maksymalnie 12 MB.');
      nextUrl = URL.createObjectURL(file);
      const image = new Image(); image.src = nextUrl;
      await image.decode();
      traceDimensions(image.naturalWidth, image.naturalHeight, options.detail);
      if (uploadJob.current !== uploadId) { URL.revokeObjectURL(nextUrl); return; }
      if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
      sourceUrl.current = nextUrl;
      setSource({ url: nextUrl, name: file.name, width: image.naturalWidth, height: image.naturalHeight });
      setResult(null);
    } catch (reason) {
      if (nextUrl) URL.revokeObjectURL(nextUrl);
      if (uploadJob.current === uploadId) setError(reason instanceof Error ? reason.message : 'Nie udało się odczytać obrazu.');
    } finally { if (uploadJob.current === uploadId) setLoading(false); }
  };

  const convert = async () => {
    if (!source || busy || loading) return;
    stop(); const jobId = job.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const image = new Image(); image.src = source.url; await image.decode();
      if (job.current !== jobId) return;
      const size = traceDimensions(source.width, source.height, options.detail);
      const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Przeglądarka nie może odczytać obrazu.');
      context.drawImage(image, 0, 0, size.width, size.height);
      const pixels = context.getImageData(0, 0, size.width, size.height);
      const current = new Worker(new URL('../workers/vectorize.worker.ts', import.meta.url), { type: 'module' });
      worker.current = current;
      current.onmessage = (event: MessageEvent<{ result?: VectorResult; error?: string }>) => {
        if (job.current !== jobId) return;
        if (event.data.result) {
          setResult({ ...event.data.result, settings: signature(options), sourceUrl: source.url });
          setNotice('SVG jest gotowe. Możesz porównać wynik z oryginałem i pobrać plik.');
          if (window.innerWidth < 1024) preview.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else setError(event.data.error || 'Nie udało się przetworzyć obrazu.');
        stop(); setBusy(false);
      };
      current.onerror = () => { if (job.current === jobId) { stop(); setBusy(false); setError('Nie udało się uruchomić wektoryzacji. Odśwież stronę i spróbuj ponownie.'); } };
      timer.current = setTimeout(() => { if (job.current === jobId) { stop(); setBusy(false); setError('Ten obraz jest zbyt złożony. Zmniejsz dokładność lub liczbę kolorów.'); } }, 30000);
      const request: VectorRequest = { image: { ...size, data: pixels.data }, options, originalWidth: source.width, originalHeight: source.height };
      current.postMessage(request, [pixels.data.buffer]);
    } catch (reason) {
      if (job.current === jobId) { stop(); setBusy(false); setError(reason instanceof Error ? reason.message : 'Nie udało się przetworzyć obrazu.'); }
    }
  };
  const changed = result && (result.settings !== signature(options) || result.sourceUrl !== source?.url);
  return <LocalSvgTool title="Wektoryzacja obrazu" description="Zamień PNG, JPG lub WebP na SVG z prawdziwymi ścieżkami. Najlepsze wyniki uzyskasz z logo, ikon i prostych rysunków; zdjęcia będą uproszczone.">
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="min-w-0"><CardContent className="space-y-5 p-4 sm:p-5">
        <div className="space-y-2"><Label htmlFor="vector-upload" className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 text-center hover:border-primary"><Upload className="h-6 w-6 text-primary"/><span>{loading ? 'Odczytuję obraz…' : source ? 'Zmień obraz' : 'Wybierz PNG, JPG lub WebP'}</span></Label><input id="vector-upload" type="file" accept="image/png,image/jpeg,image/webp" className="w-full min-w-0 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:p-2" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} /><p className="text-xs text-muted-foreground">Do 12 MB i 40 megapikseli. Plik zostaje w Twojej przeglądarce.</p></div>
        {source && <div className="space-y-2"><img src={source.url} alt="Oryginalny obraz" className="max-h-52 w-full rounded-lg border bg-muted object-contain"/><p className="break-all text-xs text-muted-foreground">{source.name} · {source.width} × {source.height} px</p></div>}
        <div className="space-y-2"><Label htmlFor="vector-mode">Tryb kolorów</Label><select id="vector-mode" disabled={busy} value={options.monochrome ? 'mono' : String(options.colors)} onChange={event => { change('monochrome', event.target.value === 'mono'); if (event.target.value !== 'mono') change('colors', Number(event.target.value)); }} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="2">2 kolory</option><option value="4">4 kolory</option><option value="8">8 kolorów</option><option value="16">16 kolorów</option><option value="mono">Czarno-biały</option></select></div>
        {options.monochrome && <div className="space-y-2"><Label htmlFor="vector-threshold">Próg czerni: {options.threshold}</Label><input id="vector-threshold" disabled={busy} type="range" min="20" max="235" value={options.threshold} onChange={event => change('threshold', Number(event.target.value))} className="h-8 w-full accent-primary" /></div>}
        <div className="space-y-2"><Label htmlFor="vector-detail">Dokładność</Label><select id="vector-detail" disabled={busy} value={options.detail} onChange={event => change('detail', Number(event.target.value))} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="384">Szybka · mniej szczegółów</option><option value="640">Standardowa</option><option value="960">Wysoka · więcej szczegółów</option></select><p className="text-xs text-muted-foreground">Większa dokładność zwiększa czas i rozmiar pliku.</p></div>
        <div className="space-y-2"><Label htmlFor="vector-smoothing">Wygładzanie</Label><select id="vector-smoothing" disabled={busy} value={options.smoothing} onChange={event => change('smoothing', Number(event.target.value))} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="0">Dokładne kontury</option><option value="1">Zrównoważone</option><option value="2">Mocne uproszczenie</option></select></div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox disabled={busy} checked={options.removeWhite} onCheckedChange={checked => change('removeWhite', checked === true)} />Usuń białe tło przy krawędziach</label>
        {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
        <Button className="h-12 w-full gap-2" disabled={!source || busy || loading} onClick={() => void convert()}>{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Upload className="h-4 w-4"/>}{busy ? 'Przetwarzam obraz…' : 'Zamień na SVG'}</Button>
        {busy && <Button className="h-11 w-full" variant="outline" onClick={() => { stop(); setBusy(false); setNotice('Wektoryzacja anulowana.'); }}>Anuluj</Button>}
        <p className="text-xs text-muted-foreground">Bez AI, kredytów i wysyłania zdjęć na serwer. Przezroczystość PNG jest zachowywana.</p>
      </CardContent></Card>
      <div ref={preview} className="min-w-0 scroll-mt-20 space-y-3">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{busy ? 'Szukam konturów i upraszczam kolory…' : notice}</p>
        {changed && <p className="rounded-lg border border-amber-500/40 p-3 text-sm">Ustawienia zmienione. Kliknij „Zamień na SVG”, aby zaktualizować wynik.</p>}
        {result ? <LocalSvgPreview svg={result.svg} title="Wynik wektoryzacji" name="obraz-wektorowy"><p className="text-xs text-muted-foreground">{result.width} × {result.height} px · Kontury: {result.paths} · {(new Blob([result.svg]).size / 1024).toFixed(1)} KB</p></LocalSvgPreview> : <div className="flex min-h-80 items-center justify-center rounded-xl border bg-muted/30 p-6 text-center text-muted-foreground">Wybierz obraz i kliknij „Zamień na SVG”. Tutaj pojawi się wynik.</div>}
      </div>
    </div>
  </LocalSvgTool>;
}
