import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CAROUSEL_NUMBER_STYLES, CAROUSEL_ARROW_STYLES, defaultCarouselNavigation, type CarouselNavigation } from '@/lib/carouselNavigation';

export function CarouselNavigationEditor({ value, onChange }: { value?: CarouselNavigation; onChange: (value: CarouselNavigation | undefined) => void }) {
  const nav = value || defaultCarouselNavigation;
  const patch = (next: Partial<CarouselNavigation>) => onChange({ ...nav, ...next });
  const visibility = (kind: 'number' | 'arrow') => <div className="space-y-2">{(['First', 'Last'] as const).map(position => <label key={position} className="flex min-h-10 items-center gap-2 text-xs"><input type="checkbox" checked={nav[`${kind}Hide${position}`]} onChange={event => patch({ [`${kind}Hide${position}`]: event.target.checked })}/>{`Ukryj ${kind === 'number' ? 'numerację' : 'strzałkę i podpis'} na ${position === 'First' ? 'pierwszym' : 'ostatnim'} slajdzie`}</label>)}</div>;
  const position = (kind: 'number' | 'arrow') => <div className="grid grid-cols-2 gap-2">{(['X','Y'] as const).map(axis => <label key={axis} className="space-y-1 text-xs">{axis === 'X' ? 'Poziomo (%)' : 'Pionowo (%)'}<input aria-label={`${kind === 'number' ? 'Numeracja' : 'Strzałka'}: ${axis === 'X' ? 'poziomo' : 'pionowo'}`} type="number" min={axis === 'X' ? 5 : 4} max={axis === 'X' ? 95 : 96} value={nav[`${kind}${axis}`]} onChange={event => { if (event.target.value !== '') patch({ [`${kind}${axis}`]: Math.max(axis === 'X' ? 5 : 4, Math.min(axis === 'X' ? 95 : 96, Number(event.target.value))) }); }} className="h-10 w-full rounded border bg-background px-2 text-sm"/></label>)}</div>;
  return <div className="space-y-5">
    <p className="text-xs text-muted-foreground">Ustawienia dotyczą całej karuzeli. Numeracja i postęp aktualizują się po dodaniu, usunięciu i przeniesieniu slajdu.</p>
    <div className="space-y-3 rounded-xl border p-3"><h3 className="text-sm font-semibold">Numeracja i postęp</h3>
      <Label htmlFor="carousel-number-style">Wygląd numeracji</Label><select id="carousel-number-style" value={nav.numberStyle} onChange={event => patch({ numberStyle: event.target.value as CarouselNavigation['numberStyle'] })} className="h-11 w-full rounded border bg-background px-2 text-sm">{CAROUSEL_NUMBER_STYLES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <div className="grid grid-cols-3 gap-1">{[{ label: 'Góra prawa', x: 91, y: 6 }, { label: 'Dół środek', x: 50, y: 95 }, { label: 'Dół prawa', x: 91, y: 95 }].map(item => <Button key={item.label} variant="outline" size="sm" className="h-auto min-h-10 whitespace-normal px-1 text-[10px]" onClick={() => patch({ numberX: item.x, numberY: item.y })}>{item.label}</Button>)}</div>
      {position('number')}
      <label className="block text-xs">Rozmiar numeracji: {nav.numberSize}<input aria-label="Rozmiar numeracji" type="range" min="18" max="60" value={nav.numberSize} onChange={event => patch({ numberSize: Number(event.target.value) })} className="h-9 w-full accent-primary"/></label>
      <label className="flex items-center justify-between text-xs">Kolor numeracji<input aria-label="Kolor numeracji" type="color" value={nav.numberColor || '#a78bfa'} className="h-9 w-12 rounded border" onChange={event => patch({ numberColor: event.target.value })}/></label>
      <Button variant="ghost" size="sm" className="text-xs" onClick={() => patch({ numberColor: undefined })}>Kolor numeracji ze stylu</Button>
      {visibility('number')}
    </div>
    <div className="space-y-3 rounded-xl border p-3"><h3 className="text-sm font-semibold">Strzałka „Przesuń dalej”</h3>
      <Label htmlFor="carousel-arrow-style">Rodzaj strzałki</Label><select id="carousel-arrow-style" value={nav.arrowStyle} onChange={event => patch({ arrowStyle: event.target.value as CarouselNavigation['arrowStyle'] })} className="h-11 w-full rounded border bg-background px-2 text-sm">{CAROUSEL_ARROW_STYLES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      {position('arrow')}
      <label className="block text-xs">Rozmiar strzałki: {nav.arrowSize}<input aria-label="Rozmiar strzałki" type="range" min="24" max="100" value={nav.arrowSize} onChange={event => patch({ arrowSize: Number(event.target.value) })} className="h-9 w-full accent-primary"/></label>
      <label className="flex items-center justify-between text-xs">Kolor strzałki<input aria-label="Kolor strzałki" type="color" value={nav.arrowColor || '#a78bfa'} className="h-9 w-12 rounded border" onChange={event => patch({ arrowColor: event.target.value })}/></label>
      <Button variant="ghost" size="sm" className="text-xs" onClick={() => patch({ arrowColor: undefined })}>Kolor strzałki ze stylu</Button>
      <Label htmlFor="carousel-arrow-caption">Podpis przy strzałce</Label><input id="carousel-arrow-caption" value={nav.caption} maxLength={40} onChange={event => patch({ caption: event.target.value })} className="h-11 w-full rounded border bg-background px-2 text-sm"/>
      <label className="flex min-h-10 items-center gap-2 text-xs"><input type="checkbox" checked={nav.captionVisible} onChange={event => patch({ captionVisible: event.target.checked })}/>Pokaż podpis przy strzałce</label>
      {visibility('arrow')}
    </div>
    <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={nav.footerLine} onChange={event => patch({ footerLine: event.target.checked })}/>Linia nad stopką</label>
    <p className="text-xs text-muted-foreground">Jeśli umieszczasz oba elementy w tym samym miejscu, zmień ich pozycję, aby się nie nakładały.</p>
    <Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal" onClick={() => onChange(undefined)}>Przywróć domyślną nawigację</Button>
  </div>;
}
