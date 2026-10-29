import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { applyWordStyle, CAROUSEL_FONTS, textStyleMap, updateTextMarks, type TextMark, type WordStyle } from '@/lib/carouselRichText';

export function CarouselTextEditor({ id, label, value, marks = [], maximum, onChange, compact = false, onFocus, selection }: { compact?: boolean; id: string; label: string; value: string; marks?: TextMark[]; maximum: number; onChange: (value: string, marks: TextMark[]) => void; onFocus?: () => void; selection?: { start: number; end: number; nonce: number } }) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [color, setColor] = useState('#e11d48');
  const [highlight, setHighlight] = useState('#fde047');
  const active = range.end > range.start && range.end <= value.length;
  const styles = textStyleMap(value, marks).slice(range.start, range.end);
  const wordSize = styles[0]?.size ?? 100;
  const selectedStyle = styles[0] || {};
  useEffect(() => {
    if (!selection) return;
    const frame = requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(selection.start, selection.end); setRange({ start: selection.start, end: selection.end }); input.current?.scrollIntoView?.({ block: 'nearest' }); });
    return () => cancelAnimationFrame(frame);
  }, [selection]);
  const apply = (style: WordStyle | null, restore = true) => {
    if (!active) return;
    onChange(value, applyWordStyle(value, marks, range.start, range.end, style));
    if (restore) { input.current?.focus(); input.current?.setSelectionRange(range.start, range.end); }
  };
  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Textarea ref={input} id={id} rows={maximum <= 100 ? 2 : 5} maxLength={maximum} value={value} onFocus={onFocus} onSelect={event => setRange({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })} onChange={event => { onChange(event.target.value, updateTextMarks(value, event.target.value, marks)); setRange({ start: event.target.selectionStart, end: event.target.selectionEnd }); }}/>
    <details className="rounded-md border p-2" open={!compact || active}><summary className="cursor-pointer text-xs font-semibold">Wyróżnij słowa</summary><div className="mt-2 space-y-2">
      <p className="break-words text-xs text-muted-foreground">{active ? `Zaznaczono: „${value.slice(range.start, range.end)}”` : 'Zaznacz słowo lub fragment w polu powyżej.'}</p>
      <div className="space-y-2"><Label htmlFor={`${id}-word-size`} className="text-xs">Wielkość zaznaczonych słów: {wordSize}%</Label><div className="flex items-center gap-2"><Button type="button" aria-label={`${label}: zmniejsz zaznaczone słowa`} variant="outline" size="sm" disabled={!active || wordSize <= 50} onMouseDown={event => event.preventDefault()} onClick={() => apply({ size: Math.max(50, wordSize - 10) })}>−</Button><input id={`${id}-word-size`} type="range" min="50" max="300" step="5" value={wordSize} disabled={!active} className="h-9 min-w-0 flex-1 accent-primary" onChange={event => apply({ size: Number(event.target.value) }, false)}/><Button type="button" aria-label={`${label}: powiększ zaznaczone słowa`} variant="outline" size="sm" disabled={!active || wordSize >= 300} onMouseDown={event => event.preventDefault()} onClick={() => apply({ size: Math.min(300, wordSize + 10) })}>+</Button></div><p className="text-[11px] text-muted-foreground">100% = zwykła wielkość. Zmienia się tylko zaznaczony fragment.</p></div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!active} aria-pressed={active && styles.every(style => style.bold)} onMouseDown={event => event.preventDefault()} onClick={() => apply({ bold: !styles.every(style => style.bold) })}>Pogrubienie</Button><Button size="sm" variant="outline" disabled={!active} aria-pressed={active && styles.every(style => style.underline)} onMouseDown={event => event.preventDefault()} onClick={() => apply({ underline: !styles.every(style => style.underline) })}>Podkreślenie</Button></div>
      <div className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-2"><input type="color" aria-label={`${label}: kolor słów`} value={color} onChange={event => setColor(event.target.value)} className="h-9 w-11 cursor-pointer rounded border"/><Button size="sm" variant="outline" disabled={!active} onMouseDown={event => event.preventDefault()} onClick={() => apply({ color })}>Nadaj kolor</Button><input type="color" aria-label={`${label}: kolor markera`} value={highlight} onChange={event => setHighlight(event.target.value)} className="h-9 w-11 cursor-pointer rounded border"/><Button size="sm" variant="outline" disabled={!active} onMouseDown={event => event.preventDefault()} onClick={() => apply({ highlight })}>Tło markera</Button></div>
      <Label htmlFor={`${id}-font`} className="text-xs">Czcionka zaznaczonego fragmentu</Label><select id={`${id}-font`} disabled={!active} value="" onChange={event => apply({ font: event.target.value })} className="h-10 w-full rounded border bg-background px-2 text-sm"><option value="" disabled>Wybierz czcionkę…</option>{CAROUSEL_FONTS.map(font => <option key={font.id} value={font.id}>{font.name}</option>)}</select>
      <details className="rounded border p-2"><summary className="cursor-pointer text-xs font-semibold">Wygląd podkreślenia i tła słów</summary><fieldset disabled={!active} className="mt-3 space-y-3">
        <div className="space-y-1"><Label htmlFor={`${id}-underline-style`} className="text-xs">Rodzaj podkreślenia</Label><select id={`${id}-underline-style`} value={selectedStyle.underlineStyle ?? 'solid'} onChange={event => apply({ underline: true, underlineStyle: event.target.value as WordStyle['underlineStyle'] }, false)} className="h-10 w-full rounded border bg-background px-2 text-sm"><option value="solid">Proste</option><option value="double">Podwójne</option><option value="dashed">Przerywane</option><option value="wavy">Falowane</option></select></div>
        <label className="flex items-center justify-between gap-2 text-xs">Kolor podkreślenia<input type="color" aria-label={`${label}: kolor podkreślenia`} className="h-9 w-12 rounded border" value={selectedStyle.underlineColor || color} onChange={event => apply({ underline: true, underlineColor: event.target.value }, false)}/></label>
        <label className="block text-xs">Grubość podkreślenia: {selectedStyle.underlineWidth ?? 3} px<input aria-label={`${label}: grubość podkreślenia`} type="range" min="1" max="12" value={selectedStyle.underlineWidth ?? 3} onChange={event => apply({ underline: true, underlineWidth: Number(event.target.value) }, false)} className="h-9 w-full accent-primary"/></label>
        <label className="block text-xs">Zaokrąglenie tła słów: {selectedStyle.highlightRadius ?? 0}<input aria-label={`${label}: zaokrąglenie tła słów`} type="range" min="0" max="32" value={selectedStyle.highlightRadius ?? 0} onChange={event => apply({ highlight: selectedStyle.highlight || highlight, highlightRadius: Number(event.target.value) }, false)} className="h-9 w-full accent-primary"/></label>
        <label className="block text-xs">Odstęp tła od słów: {selectedStyle.highlightPadding ?? 0}<input aria-label={`${label}: odstęp tła słów`} type="range" min="0" max="24" value={selectedStyle.highlightPadding ?? 0} onChange={event => apply({ highlight: selectedStyle.highlight || highlight, highlightPadding: Number(event.target.value) }, false)} className="h-9 w-full accent-primary"/></label>
        <label className="block text-xs">Krycie tła słów: {selectedStyle.highlightOpacity ?? 100}%<input aria-label={`${label}: krycie tła słów`} type="range" min="0" max="100" value={selectedStyle.highlightOpacity ?? 100} onChange={event => apply({ highlight: selectedStyle.highlight || highlight, highlightOpacity: Number(event.target.value) }, false)} className="h-9 w-full accent-primary"/></label>
        <Button type="button" variant="outline" size="sm" onMouseDown={event => event.preventDefault()} onClick={() => apply({ highlight: undefined, highlightRadius: undefined, highlightPadding: undefined, highlightOpacity: undefined })}>Usuń tylko tło słów</Button>
      </fieldset></details>
      <Button size="sm" variant="ghost" disabled={!active} onMouseDown={event => event.preventDefault()} onClick={() => apply(null)}>Usuń wyróżnienie</Button>
    </div></details><p className="text-xs text-muted-foreground">{value.length}/{maximum} znaków. Dłuższy tekst automatycznie pomniejszamy.</p>
  </div>;
}
