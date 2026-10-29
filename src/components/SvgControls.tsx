import { useState } from 'react';
import { Copy, Download, Image } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { downloadSvg, downloadSvgPng } from '@/lib/svgTools';

export function SvgColorInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-2 py-1">
      <Input id={id} type="color" value={value} onChange={event => onChange(event.target.value)} className="h-9 w-11 shrink-0 cursor-pointer border-0 p-1" />
      <span className="truncate text-xs text-muted-foreground">{value.toUpperCase()}</span>
    </div>
  </div>;
}

export function SvgExportActions({ svg, name }: { svg: string | (() => string); name: string }) {
  const [busy, setBusy] = useState(false);
  const getSvg = () => typeof svg === 'function' ? svg() : svg;
  const savePng = async () => {
    setBusy(true);
    try { await downloadSvgPng(getSvg(), name); toast.success('PNG pobrane'); }
    catch { toast.error('Nie udało się zapisać PNG. Możesz pobrać SVG.'); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(getSvg()); toast.success('SVG skopiowane'); }
    catch { toast.error('Nie udało się skopiować. Pobierz plik SVG.'); }
  };
  return <div className="grid gap-2 sm:grid-cols-3">
    <Button className="h-11 min-w-0 gap-2 px-2" onClick={() => downloadSvg(getSvg(), name)}><Download className="h-4 w-4" />Pobierz SVG</Button>
    <Button variant="outline" className="h-11 min-w-0 gap-2 px-2" disabled={busy} onClick={() => void savePng()}><Image className="h-4 w-4" />{busy ? 'Zapisuję…' : 'Pobierz PNG'}</Button>
    <Button variant="outline" className="h-11 min-w-0 gap-2 px-2" onClick={() => void copy()}><Copy className="h-4 w-4" />Kopiuj SVG</Button>
  </div>;
}
