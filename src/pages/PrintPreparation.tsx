import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { LocalSvgTool } from '@/components/LocalSvgTool';
import { SvgColorInput } from '@/components/SvgControls';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { decodeLocalImage, readLocalDesignImage } from '@/lib/localDesignExport';
import { defaultPrintOptions, PRINT_FORMATS, printGeometry, printImagePlacement, printPdfBoxes, renderPrintCanvas, type PrintOptions } from '@/lib/printDesign';

type PrintSource = { name: string; dataUrl: string; width: number; height: number };
export default function PrintPreparation() {
  const [options, setOptions] = useState(defaultPrintOptions);
  const [source, setSource] = useState<PrintSource | null>(null);
  const [preset, setPreset] = useState('a5');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rendered, setRendered] = useState<{ source: PrintSource; options: PrintOptions } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const uploadJob = useRef(0);
  const rendering = rendered?.source !== source || rendered?.options !== options;
  const change = <K extends keyof PrintOptions>(key: K, value: PrintOptions[K]) => setOptions(previous => ({ ...previous, [key]: value }));
  let geometry: ReturnType<typeof printGeometry> | null = null, validation = '';
  try { geometry = printGeometry(options); } catch (reason) { validation = reason instanceof Error ? reason.message : 'Sprawdź ustawienia.'; }
  const effectiveDpi = geometry && source ? printImagePlacement(source.width, source.height, options).dpi : null;
  const cropped = source && geometry && options.fit === 'cover' && Math.abs(source.width / source.height - geometry.bleedWidth / geometry.bleedHeight) > 0.01;
  useEffect(() => {
    if (!source || validation) return;
    let cancelled = false;
    void decodeLocalImage(source.dataUrl).then(image => { if (!cancelled && canvas.current) renderPrintCanvas(canvas.current, image, options, true); }).catch(() => { if (!cancelled) setError('Nie udało się wyświetlić obrazu.'); }).finally(() => { if (!cancelled) setRendered({ source, options }); });
    return () => { cancelled = true; };
  }, [source, options, validation]);
  useEffect(() => () => { uploadJob.current++; }, []);
  const upload = async (file?: File) => {
    if (!file) return;
    const id = ++uploadJob.current; setLoading(true); setError(''); setNotice('');
    try { const next = await readLocalDesignImage(file); if (id === uploadJob.current) setSource({ ...next, name: file.name }); }
    catch (reason) { if (id === uploadJob.current) setError(reason instanceof Error ? reason.message : 'Nie udało się dodać pliku.'); }
    finally { if (id === uploadJob.current) setLoading(false); }
  };
  const exportPdf = async () => {
    if (!source || !geometry || busy || loading) return;
    setBusy(true); setError(''); setNotice('Przygotowuję PDF…');
    try {
      const image = await decodeLocalImage(source.dataUrl);
      const target = document.createElement('canvas');
      const page = renderPrintCanvas(target, image, options);
      const { default: JsPDF } = await import('jspdf');
      const pdf = new JsPDF({ unit: 'mm', format: [page.pageWidth, page.pageHeight], orientation: page.pageWidth > page.pageHeight ? 'landscape' : 'portrait', compress: true });
      Object.assign(pdf.getCurrentPageInfo().pageContext, printPdfBoxes(options));
      pdf.addImage(target.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, page.pageWidth, page.pageHeight);
      pdf.save('grafika-do-druku.pdf'); target.width = 1; target.height = 1;
      setNotice('PDF jest gotowy. Linie pomocnicze z podglądu nie są drukowane.');
    } catch (reason) { setNotice(''); setError(reason instanceof Error ? reason.message : 'Nie udało się przygotować PDF.'); }
    finally { setBusy(false); }
  };
  return <LocalSvgTool title="Przygotowanie do druku" description="Dopasuj grafikę do formatu w milimetrach. Dodaj spady i znaczniki cięcia, sprawdź rozdzielczość i pobierz PDF.">
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="min-w-0"><CardContent className="space-y-5 p-4 sm:p-5">
        <fieldset disabled={busy || loading} className="min-w-0 space-y-5">
          <div className="space-y-2"><Label htmlFor="print-image">Grafika PNG, JPG lub WebP</Label><input id="print-image" type="file" accept="image/png,image/jpeg,image/webp" className="w-full min-w-0 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:p-2" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} /><p className="text-xs text-muted-foreground">Do 12 MB i 40 megapikseli. Plik zostaje w przeglądarce.</p>{source && <p className="break-all text-xs text-muted-foreground">{source.name} · {source.width} × {source.height} px</p>}</div>
          <div className="space-y-2"><Label htmlFor="print-format">Format po obcięciu</Label><select id="print-format" value={preset} onChange={event => { setPreset(event.target.value); const format = PRINT_FORMATS.find(item => item.id === event.target.value); if (format) setOptions(previous => ({ ...previous, width: format.width, height: format.height, offsetX: 0, offsetY: 0 })); }} className="h-11 w-full rounded-md border bg-background px-3 text-sm">{PRINT_FORMATS.map(format => <option key={format.id} value={format.id}>{format.name} · {format.width} × {format.height} mm</option>)}<option value="custom">Własny rozmiar</option></select></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="print-width">Szerokość (mm)</Label><Input id="print-width" type="number" min="20" max="420" step="0.1" value={options.width} onChange={event => { setPreset('custom'); change('width', Number(event.target.value)); }} /></div><div className="space-y-2"><Label htmlFor="print-height">Wysokość (mm)</Label><Input id="print-height" type="number" min="20" max="420" step="0.1" value={options.height} onChange={event => { setPreset('custom'); change('height', Number(event.target.value)); }} /></div></div>
          <Button variant="outline" className="h-11 w-full" onClick={() => { setPreset('custom'); setOptions(previous => ({ ...previous, width: previous.height, height: previous.width })); }}>Zamień pion / poziom</Button>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="print-bleed">Spad (mm)</Label><Input id="print-bleed" type="number" min="0" max="10" step="0.5" value={options.bleed} onChange={event => change('bleed', Number(event.target.value))} /></div><div className="space-y-2"><Label htmlFor="print-safe">Bezpieczny margines (mm)</Label><Input id="print-safe" type="number" min="0" max="20" step="0.5" value={options.safe} onChange={event => change('safe', Number(event.target.value))} /></div></div>
          <div className="space-y-2"><Label htmlFor="print-fit">Dopasowanie grafiki</Label><select id="print-fit" value={options.fit} onChange={event => change('fit', event.target.value as PrintOptions['fit'])} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="cover">Wypełnij ze spadem · kadruj</option><option value="contain">Pokaż cały obraz · dodaj tło</option></select>{cropped && <p className="text-xs text-amber-700 dark:text-amber-300">Ten tryb przycina część obrazu. Sprawdź napisy i logo lub wybierz „Pokaż cały obraz”.</p>}</div>
          {options.fit === 'cover' && <><div className="space-y-2"><Label htmlFor="print-x">Pozycja pozioma</Label><input id="print-x" type="range" min="-100" max="100" value={options.offsetX} onChange={event => change('offsetX', Number(event.target.value))} className="h-8 w-full accent-primary" /></div><div className="space-y-2"><Label htmlFor="print-y">Pozycja pionowa</Label><input id="print-y" type="range" min="-100" max="100" value={options.offsetY} onChange={event => change('offsetY', Number(event.target.value))} className="h-8 w-full accent-primary" /></div></>}
          <SvgColorInput id="print-background" label="Kolor tła" value={options.background} onChange={value => change('background', value)} />
          <div className="space-y-2"><Label htmlFor="print-dpi">Rozdzielczość eksportu</Label><select id="print-dpi" value={options.dpi} onChange={event => change('dpi', Number(event.target.value))} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="300">300 dpi</option><option value="150">150 dpi · lżejszy plik</option></select></div>
          <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={options.marks} onCheckedChange={value => change('marks', value === true)} />Dodaj znaczniki cięcia</label>
        </fieldset>
        {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </CardContent></Card>
      <section className="min-w-0 space-y-4 lg:sticky lg:top-20" aria-label="Podgląd druku">
        <Card><CardContent className="space-y-4 p-3 sm:p-5">{source ? <canvas ref={canvas} role="img" aria-label="Podgląd grafiki do druku" className={`mx-auto max-h-[650px] w-full border object-contain ${validation ? 'opacity-30' : ''}`} /> : <div className="flex min-h-80 items-center justify-center rounded-lg border bg-muted/30 p-6 text-center text-muted-foreground">Dodaj grafikę, aby zobaczyć podgląd druku.</div>}
          <p className="text-xs text-muted-foreground"><span className="text-purple-600">Fioletowa linia: cięcie.</span> <span className="text-emerald-600">Zielona linia: bezpieczny obszar.</span> Ważne napisy i logo umieść wewnątrz zielonej ramki. Kolorowe linie są widoczne tylko w podglądzie.</p>
        </CardContent></Card>
        {geometry && <div className="rounded-lg border p-3 text-sm space-y-1"><p>Po obcięciu: <strong>{options.width} × {options.height} mm</strong></p><p>Cała strona PDF: {geometry.pageWidth} × {geometry.pageHeight} mm</p><p>Eksport: {geometry.pixelWidth} × {geometry.pixelHeight} px · {options.dpi} dpi</p>{effectiveDpi !== null && <p className={effectiveDpi < 150 ? 'text-destructive' : 'text-muted-foreground'}>Rozdzielczość źródła w tym rozmiarze: około {effectiveDpi} dpi.{effectiveDpi < options.dpi ? ' Wybierz większy obraz lub mniejszy format — zwiększenie dpi eksportu nie doda szczegółów.' : ''}</p>}</div>}
        <Button disabled={!source || !geometry || busy || loading || rendering} onClick={() => void exportPdf()} className="h-12 w-full gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}{busy ? 'Przygotowuję PDF…' : 'Pobierz PDF do druku'}</Button>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{loading ? 'Wczytuję grafikę…' : notice}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">PDF zapisujemy w RGB, z obszarem cięcia i spadu. Jeśli drukarnia wymaga CMYK lub PDF/X, plik wymaga dodatkowego przygotowania zgodnie z jej wytycznymi.</p>
      </section>
    </div>
  </LocalSvgTool>;
}
