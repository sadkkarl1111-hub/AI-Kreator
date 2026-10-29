import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { LocalSvgTool } from '@/components/LocalSvgTool';
import { SvgColorInput } from '@/components/SvgControls';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { batchOutputName, defaultBatchOptions, encodeBatchCanvas, renderBatchImage, type BatchOptions } from '@/lib/batchImages';
import { decodeLocalImage, readLocalDesignImage, saveLocalBlob } from '@/lib/localDesignExport';

type Result = { blob: Blob; name: string; width: number; height: number; originalSize: number };
export default function BatchImageEditor() {
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState(defaultBatchOptions);
  const [results, setResults] = useState<Result[]>([]);
  const [resultOptions, setResultOptions] = useState<BatchOptions | null>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadingLogo, setLoadingLogo] = useState(false);
  const [packing, setPacking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [previewError, setPreviewError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const run = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const uploadJob = useRef(0);
  const locked = busy || loadingLogo || packing;
  const change = <K extends keyof BatchOptions>(key: K, value: BatchOptions[K]) => setOptions(previous => ({ ...previous, [key]: value }));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; run.current?.abort(); }; }, []);
  useEffect(() => {
    if (!files[selected]) return;
    let cancelled = false;
    const url = URL.createObjectURL(files[selected]);
    void (async () => {
      try {
        const [image, logo] = await Promise.all([decodeLocalImage(url), options.logo ? decodeLocalImage(options.logo) : null]);
        if (!cancelled && canvas.current) {
          const target = document.createElement('canvas'); renderBatchImage(target, image, { ...options, maxEdge: 1080 }, logo);
          const width = Math.min(1000, target.width), height = Math.round(target.height * width / target.width);
          canvas.current.width = width; canvas.current.height = height; canvas.current.getContext('2d')?.drawImage(target, 0, 0, width, height);
          setPreviewError('');
          target.width = 1; target.height = 1;
        }
      } catch (reason) { if (!cancelled) { const context = canvas.current?.getContext('2d'); if (context && canvas.current) context.clearRect(0, 0, canvas.current.width, canvas.current.height); setPreviewError(reason instanceof Error ? reason.message : 'Nie udało się przygotować podglądu.'); } }
      finally { URL.revokeObjectURL(url); }
    })();
    return () => { cancelled = true; };
  }, [files, selected, options]);
  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files], rejected: string[] = [];
    let total = next.reduce((sum, file) => sum + file.size, 0);
    for (const file of Array.from(incoming)) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { rejected.push(`${file.name}: wybierz PNG, JPG lub WebP.`); continue; }
      if (file.size > 12 * 1024 * 1024) { rejected.push(`${file.name}: przekroczono 12 MB.`); continue; }
      if (next.length >= 30 || total + file.size > 150 * 1024 * 1024) { rejected.push(`${file.name}: limit paczki to 30 plików i 150 MB.`); continue; }
      total += file.size; next.push(file);
    }
    if (next.length === files.length) { setErrors(rejected); return; }
    setFiles(next); setResults([]); setResultOptions(null); setErrors(rejected); setNotice('');
  };
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    const id = ++uploadJob.current; setLoadingLogo(true); setErrors([]);
    try { const image = await readLocalDesignImage(file, 800); if (id === uploadJob.current && mounted.current) change('logo', image.dataUrl); }
    catch (reason) { if (id === uploadJob.current && mounted.current) setErrors([reason instanceof Error ? reason.message : 'Nie udało się dodać logo.']); }
    finally { if (id === uploadJob.current && mounted.current) setLoadingLogo(false); }
  };
  const process = async () => {
    if (locked || !files.length || (options.watermark === 'logo' && !options.logo)) return;
    const controller = new AbortController(); run.current = controller;
    setBusy(true); setErrors([]); setResults([]); setProgress(0); setResultOptions(options); setNotice('Przetwarzam zdjęcia…');
    const completed: Result[] = [], failed: string[] = [];
    let outputBytes = 0;
    try {
      const logo = options.logo && options.watermark === 'logo' ? await decodeLocalImage(options.logo) : null;
      for (const [index, file] of files.entries()) {
        if (controller.signal.aborted) break;
        const url = URL.createObjectURL(file), target = document.createElement('canvas');
        try {
          const image = await decodeLocalImage(url); if (controller.signal.aborted) break;
          const dimensions = renderBatchImage(target, image, options, logo);
          const blob = await encodeBatchCanvas(target, options); if (controller.signal.aborted) break;
          if (outputBytes + blob.size > 120 * 1024 * 1024) { failed.push('Osiągnięto limit wyników 120 MB. Zmniejsz rozmiar lub wybierz JPG/WebP.'); break; }
          outputBytes += blob.size; completed.push({ blob, name: batchOutputName(file.name, index, options.format), ...dimensions, originalSize: file.size });
          if (mounted.current) setResults([...completed]);
        } catch (reason) { if (!controller.signal.aborted) failed.push(`${file.name}: ${reason instanceof Error ? reason.message : 'Nie udało się przetworzyć pliku.'}`); }
        finally { URL.revokeObjectURL(url); target.width = 1; target.height = 1; }
        if (mounted.current) setProgress(index + 1);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (mounted.current) { setErrors(failed); setNotice(controller.signal.aborted ? `Anulowano. Gotowe pliki: ${completed.length}. Możesz pobrać ukończone wyniki.` : `Gotowe pliki: ${completed.length} z ${files.length}.`); }
    } catch (reason) { if (mounted.current) setErrors([reason instanceof Error ? reason.message : 'Nie udało się uruchomić przetwarzania.']); }
    finally { if (run.current === controller) run.current = null; if (mounted.current) setBusy(false); }
  };
  const downloadZip = async () => {
    if (!results.length || locked) return; setPacking(true); setErrors([]);
    try {
      const { zipSync } = await import('fflate');
      const entries: Record<string, Uint8Array> = {};
      for (const result of results) entries[result.name] = new Uint8Array(await result.blob.arrayBuffer());
      saveLocalBlob(new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' }), 'zdjecia-po-edycji.zip');
    } catch { setErrors(['Nie udało się przygotować ZIP. Pobierz pliki pojedynczo lub przetwórz mniejszą paczkę.']); }
    finally { if (mounted.current) setPacking(false); }
  };
  const sourceBytes = results.reduce((sum, result) => sum + result.originalSize, 0), resultBytes = results.reduce((sum, result) => sum + result.blob.size, 0);
  const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return <LocalSvgTool title="Edycja wielu zdjęć" description="Zmień format, zmniejsz rozmiar i dodaj tekst lub logo do całej paczki. Pobierz wyniki razem w ZIP. Zdjęcia pozostają na Twoim urządzeniu.">
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="min-w-0"><CardContent className="space-y-5 p-4 sm:p-5"><fieldset disabled={locked} className="min-w-0 space-y-5">
        <div className="space-y-2"><Label htmlFor="batch-files">Dodaj zdjęcia do paczki</Label><input id="batch-files" multiple type="file" accept="image/png,image/jpeg,image/webp" className="w-full min-w-0 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:p-2" onChange={event => { addFiles(event.target.files); event.target.value = ''; }}/><p className="text-xs text-muted-foreground">Do 30 plików, 12 MB każdy i 150 MB łącznie.</p></div>
        <div className="space-y-2"><Label htmlFor="batch-format">Format wynikowy</Label><select id="batch-format" value={options.format} onChange={event => change('format', event.target.value as BatchOptions['format'])} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="jpeg">JPG · mniejsze pliki</option><option value="webp">WebP · zdjęcia do internetu</option><option value="png">PNG · zachowaj przezroczystość</option></select></div>
        {options.format !== 'png' && <div className="space-y-2"><Label htmlFor="batch-quality">Jakość: {options.quality}%</Label><input id="batch-quality" type="range" min="30" max="100" value={options.quality} onChange={event => change('quality', Number(event.target.value))} className="h-8 w-full accent-primary"/></div>}
        <div className="space-y-2"><Label htmlFor="batch-size">Maksymalny dłuższy bok</Label><select id="batch-size" value={options.maxEdge} onChange={event => change('maxEdge', Number(event.target.value))} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="1080">1080 px</option><option value="1600">1600 px</option><option value="1920">1920 px</option><option value="2560">2560 px</option><option value="0">Oryginalny rozmiar · do 20 Mpx</option></select><p className="text-xs text-muted-foreground">Mniejszych obrazów nie powiększamy.</p></div>
        {options.format === 'jpeg' && <SvgColorInput id="batch-background" label="Tło zamiast przezroczystości" value={options.background} onChange={value => change('background', value)}/>}
        <div className="space-y-2"><Label htmlFor="batch-watermark">Znak wodny</Label><select id="batch-watermark" value={options.watermark} onChange={event => change('watermark', event.target.value as BatchOptions['watermark'])} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="none">Bez znaku wodnego</option><option value="text">Napis</option><option value="logo">Logo</option></select></div>
        {options.watermark === 'text' && <><div className="space-y-2"><Label htmlFor="batch-text">Treść znaku wodnego</Label><Input id="batch-text" maxLength={80} value={options.text} onChange={event => change('text', event.target.value)}/></div><SvgColorInput id="batch-color" label="Kolor napisu" value={options.color} onChange={value => change('color', value)}/></>}
        {options.watermark === 'logo' && <div className="space-y-2"><Label htmlFor="batch-logo">Logo PNG, JPG lub WebP</Label><input id="batch-logo" type="file" accept="image/png,image/jpeg,image/webp" className="w-full min-w-0 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:p-2" onChange={event => { void uploadLogo(event.target.files?.[0]); event.target.value = ''; }}/>{options.logo && <><img src={options.logo} alt="Logo znaku wodnego" className="max-h-20 max-w-full rounded border bg-muted p-2 object-contain"/><Button variant="outline" onClick={() => change('logo', '')}>Usuń logo</Button></>}</div>}
        {options.watermark !== 'none' && <><div className="space-y-2"><Label htmlFor="batch-position">Położenie znaku</Label><select id="batch-position" value={options.position} onChange={event => change('position', event.target.value as BatchOptions['position'])} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="bottom-right">Prawy dół</option><option value="bottom-left">Lewy dół</option><option value="top-right">Prawa góra</option><option value="top-left">Lewa góra</option><option value="center">Środek</option></select></div><div className="space-y-2"><Label htmlFor="batch-opacity">Widoczność znaku: {options.opacity}%</Label><input id="batch-opacity" type="range" min="5" max="100" value={options.opacity} onChange={event => change('opacity', Number(event.target.value))} className="h-8 w-full accent-primary"/></div><div className="space-y-2"><Label htmlFor="batch-mark-size">Wielkość znaku: {options.size}%</Label><input id="batch-mark-size" type="range" min="5" max="35" value={options.size} onChange={event => change('size', Number(event.target.value))} className="h-8 w-full accent-primary"/></div></>}
      </fieldset>
      <Button disabled={locked || !files.length || (options.watermark === 'logo' && !options.logo)} className="h-12 w-full gap-2" onClick={() => void process()}>{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}{busy ? `Przetwarzam ${progress}/${files.length}…` : `Przetwórz paczkę (${files.length})`}</Button>
      {busy && <Button className="h-11 w-full" variant="outline" onClick={() => run.current?.abort()}>Anuluj przetwarzanie</Button>}
      </CardContent></Card>
      <section className="min-w-0 space-y-4" aria-label="Podgląd i wyniki paczki">
        {files.length ? <><Card><CardContent className="space-y-3 p-3 sm:p-5"><Label htmlFor="batch-preview">Podgląd ustawień na zdjęciu</Label><select id="batch-preview" value={selected} disabled={busy} onChange={event => setSelected(Number(event.target.value))} className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm">{files.map((file, index) => <option key={`${index}-${file.name}`} value={index}>{index + 1}. {file.name}</option>)}</select><div className="flex min-h-48 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"><canvas ref={canvas} role="img" aria-label="Podgląd edycji zdjęcia" className="max-h-[480px] w-full object-contain"/></div><p className="text-xs text-muted-foreground">Podgląd pokazuje bieżące ustawienia. Pliki wynikowe tworzymy przyciskiem „Przetwórz paczkę”.</p></CardContent></Card><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm">Plików: {files.length} · {megabytes(files.reduce((sum, file) => sum + file.size, 0))}</p><Button disabled={locked} variant="outline" className="h-11 gap-2" onClick={() => { setFiles([]); setSelected(0); setResults([]); setNotice(''); setErrors([]); }}><Trash2 className="h-4 w-4"/>Wyczyść paczkę</Button></div></> : <div className="flex min-h-72 items-center justify-center rounded-xl border bg-muted/30 p-6 text-center text-muted-foreground">Dodaj kilka zdjęć, aby zmienić ich format lub dodać znak wodny.</div>}
        {previewError && files.length > 0 && <p role="alert" className="text-sm text-destructive">{previewError}</p>}
        {busy && <progress value={progress} max={files.length} aria-label="Postęp przetwarzania" className="h-3 w-full accent-primary"/>}
        {results.length > 0 && <><div className="space-y-2 rounded-lg border p-3 text-sm"><p>Gotowe: {results.length} · {megabytes(sourceBytes)} → {megabytes(resultBytes)}</p>{resultBytes > sourceBytes && <p className="text-xs text-muted-foreground">Wynik jest większy od oryginału. Zmniejsz jakość lub wybierz JPG/WebP.</p>}{resultOptions !== options && <p className="text-amber-700 dark:text-amber-300">Ustawienia zmienione. Przetwórz paczkę ponownie, aby je zastosować do pobieranych plików.</p>}</div><Button disabled={locked} className="h-12 w-full gap-2" onClick={() => void downloadZip()}>{packing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}Pobierz gotowe pliki ZIP ({results.length})</Button><div className="space-y-2">{results.map((result, index) => <div key={result.name} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div className="min-w-0"><p className="break-all text-sm">{result.name}</p><p className="text-xs text-muted-foreground">{result.width} × {result.height} px · {megabytes(result.blob.size)}</p></div><Button disabled={busy} variant="outline" className="h-11" aria-label={`Pobierz wynik ${index + 1}`} onClick={() => saveLocalBlob(result.blob, result.name)}>Pobierz</Button></div>)}</div></>}
        {errors.length > 0 && <div role="alert" className="space-y-1 rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{errors.map((error, index) => <p key={index} className="break-words">{error}</p>)}</div>}
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{loadingLogo ? 'Wczytuję logo…' : notice}</p>
      </section>
    </div>
  </LocalSvgTool>;
}
