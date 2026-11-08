import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Upload } from 'lucide-react';
import { zipSync } from 'fflate';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Mode = 'rounded' | 'frame' | 'tiles';
const TITLES: Record<Mode, string> = { rounded: 'Zaokrąglanie rogów', frame: 'Cień i ramka', tiles: 'Podziel zdjęcie na kafelki' };
const DESCRIPTIONS: Record<Mode, string> = {
  rounded: 'Zaokrąglij rogi lub wytnij zdjęcie w koło. Pobierz PNG z przezroczystym tłem.',
  frame: 'Dodaj margines, kolorową ramkę i miękki cień do zdjęcia lub zrzutu ekranu.',
  tiles: 'Podziel całe zdjęcie na równą siatkę. Pobierz ponumerowane kafelki PNG w pliku ZIP.',
};

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function png(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Nie udało się zapisać obrazu.')), 'image/png'));
}

export default function FreePhotoTools({ mode }: { mode: Mode }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [radius, setRadius] = useState(12);
  const [circle, setCircle] = useState(false);
  const [padding, setPadding] = useState(10);
  const [color, setColor] = useState('#e2e8f0');
  const [shadow, setShadow] = useState(true);
  const [columns, setColumns] = useState(3);
  const [rows, setRows] = useState(3);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadVersion = useRef(0);
  useEffect(() => () => { uploadVersion.current++; }, []);

  async function upload(file: File) {
    const version = ++uploadVersion.current;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
      toast.error('Wybierz PNG, JPG lub WebP do 20 MB.');
      return;
    }
    setReading(true);
    const url = URL.createObjectURL(file);
    try {
      const loaded = new Image();
      loaded.src = url;
      await loaded.decode();
      // Keep canvas memory bounded on phones; all tools use this same working image.
      const scale = Math.min(1, 2400 / Math.max(loaded.naturalWidth, loaded.naturalHeight));
      if (scale < 1) {
        const work = document.createElement('canvas');
        work.width = Math.max(1, Math.round(loaded.naturalWidth * scale));
        work.height = Math.max(1, Math.round(loaded.naturalHeight * scale));
        work.getContext('2d')!.drawImage(loaded, 0, 0, work.width, work.height);
        loaded.src = work.toDataURL('image/png');
        await loaded.decode();
      }
      if (version === uploadVersion.current) setImage(loaded);
    } catch {
      if (version === uploadVersion.current) toast.error('Nie udało się odczytać zdjęcia. Wybierz inny plik.');
    } finally {
      URL.revokeObjectURL(url);
      if (version === uploadVersion.current) setReading(false);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const w = image.naturalWidth, h = image.naturalHeight;
    const margin = mode === 'frame' ? Math.round(Math.max(w, h) * padding / 100) : 0;
    canvas.width = mode === 'rounded' && circle ? Math.min(w, h) : w + margin * 2;
    canvas.height = mode === 'rounded' && circle ? Math.min(w, h) : h + margin * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (mode === 'frame') {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = margin * 0.45;
        ctx.shadowOffsetY = margin * 0.15;
      }
      ctx.drawImage(image, margin, margin);
    } else if (mode === 'rounded') {
      ctx.beginPath();
      if (circle) ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
      else ctx.roundRect(0, 0, w, h, Math.min(w, h) * radius / 100);
      ctx.clip();
      ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2);
    } else {
      ctx.drawImage(image, 0, 0);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, w / 500);
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      for (let c = 1; c < columns; c++) { ctx.beginPath(); ctx.moveTo(w * c / columns, 0); ctx.lineTo(w * c / columns, h); ctx.stroke(); }
      for (let r = 1; r < rows; r++) { ctx.beginPath(); ctx.moveTo(0, h * r / rows); ctx.lineTo(w, h * r / rows); ctx.stroke(); }
    }
  }, [image, mode, radius, circle, padding, color, shadow, columns, rows]);

  async function download() {
    if (!image || !canvasRef.current) return;
    setBusy(true);
    try {
      if (mode !== 'tiles') saveBlob(await png(canvasRef.current), `${mode === 'frame' ? 'ramka' : 'zaokraglone'}.png`);
      else {
        const files: Record<string, Uint8Array> = {};
        const canvas = document.createElement('canvas');
        for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
          const x = Math.round(image.naturalWidth * c / columns), y = Math.round(image.naturalHeight * r / rows);
          canvas.width = Math.round(image.naturalWidth * (c + 1) / columns) - x;
          canvas.height = Math.round(image.naturalHeight * (r + 1) / rows) - y;
          if (!canvas.width || !canvas.height) throw new Error('Zdjęcie jest za małe dla tej siatki.');
          canvas.getContext('2d')!.drawImage(image, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
          files[`kafelek-${String(r * columns + c + 1).padStart(2, '0')}-wiersz-${r + 1}-kolumna-${c + 1}.png`] = new Uint8Array(await (await png(canvas)).arrayBuffer());
        }
        saveBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), 'kafelki.zip');
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Nie udało się pobrać pliku.'); }
    finally { setBusy(false); }
  }

  return <AppLayout><div className="max-w-4xl mx-auto space-y-6">
    <div className="flex items-center gap-3">
      <Link to="/tools"><Button variant="ghost" size="icon" aria-label="Wróć do narzędzi"><ArrowLeft className="w-5 h-5" /></Button></Link>
      <div><h1 className="text-2xl font-bold">{TITLES[mode]}</h1><p className="text-sm text-muted-foreground">{DESCRIPTIONS[mode]}</p></div>
    </div>
    <p className="text-sm text-muted-foreground">Darmowe, bez konta i kredytów. Zdjęcie jest przetwarzane w Twojej przeglądarce. Maksymalny bok wyniku: 2400 px.</p>
    <Card><CardContent className="pt-6 space-y-6">
      <label className="flex flex-col gap-3 rounded-xl border border-dashed p-6">
        <span className="flex items-center gap-2 text-sm font-medium"><Upload className="w-4 h-4" />{reading ? 'Wczytuję zdjęcie...' : image ? 'Zmień zdjęcie' : 'Wgraj zdjęcie'}</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || reading} aria-label="Wybierz zdjęcie" className="text-sm max-w-full" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ''; }} />
      </label>
      {image && <>
        <fieldset disabled={busy || reading} className="flex flex-wrap gap-5">
          {mode === 'rounded' && <>
            <label className="text-sm space-y-2"><span className="block">Zaokrąglenie: {radius}%</span><input aria-label="Zaokrąglenie" type="range" min="0" max="50" value={radius} disabled={circle} onChange={e => setRadius(Number(e.target.value))} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={circle} onChange={e => setCircle(e.target.checked)} />Wytnij w koło</label>
          </>}
          {mode === 'frame' && <>
            <label className="text-sm space-y-2"><span className="block">Margines: {padding}%</span><input aria-label="Margines" type="range" min="3" max="25" value={padding} onChange={e => setPadding(Number(e.target.value))} /></label>
            <label className="flex items-center gap-2 text-sm">Kolor ramki<input type="color" value={color} onChange={e => setColor(e.target.value)} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shadow} onChange={e => setShadow(e.target.checked)} />Miękki cień</label>
          </>}
          {mode === 'tiles' && <>
            <label className="text-sm">Kolumny <select className="bg-background border rounded-md p-2" value={columns} onChange={e => setColumns(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n}>{n}</option>)}</select></label>
            <label className="text-sm">Wiersze <select className="bg-background border rounded-md p-2" value={rows} onChange={e => setRows(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n}>{n}</option>)}</select></label>
            <p className="text-sm text-muted-foreground">{columns * rows} kafelków. Numeracja od lewej do prawej, od góry do dołu. Linie podglądu nie są zapisywane.</p>
          </>}
        </fieldset>
        <div className="overflow-hidden rounded-xl border bg-muted/30 p-3"><canvas ref={canvasRef} aria-label="Podgląd wyniku" className="block max-w-full max-h-[560px] mx-auto object-contain" /></div>
        <p className="text-xs text-muted-foreground">Zdjęcie robocze: {image.naturalWidth} × {image.naturalHeight} px{mode === 'rounded' && circle ? '. Kadr kołowy jest wycinany ze środka zdjęcia.' : '.'}</p>
        <Button onClick={download} disabled={busy || reading} className="gap-2"><Download className="w-4 h-4" />{busy ? 'Przygotowuję plik...' : mode === 'tiles' ? 'Pobierz kafelki ZIP' : 'Pobierz PNG'}</Button>
      </>}
    </CardContent></Card>
  </div></AppLayout>;
}
