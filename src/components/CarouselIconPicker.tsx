import { useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SvgColorInput } from '@/components/SvgControls';
import { useLocalAssetFavorites } from '@/hooks/useLocalAssetFavorites';
import { SVG_ICONS, filterSvgIcons, type SvgIconItem } from '@/lib/svgCatalog';
import { serializeIconSvg, svgDataUrl } from '@/lib/svgTools';
import { decodeLocalImage } from '@/lib/localDesignExport';
import type { CarouselLibraryImage } from '@/lib/carouselLibrary';

export function CarouselIconPicker({ onChoose, disabled, signal }: { onChoose: (image: CarouselLibraryImage) => Promise<void>; disabled: boolean; signal: AbortSignal }) {
  const [search, setSearch] = useState(''), [category, setCategory] = useState('all'), [color, setColor] = useState('#7c3aed'), [stroke, setStroke] = useState(2);
  const [visible, setVisible] = useState(48), [onlyFavorites, setOnlyFavorites] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const favorites = useLocalAssetFavorites('icons');
  const items = filterSvgIcons(search, category).filter(item => !onlyFavorites || favorites.has(item.id));
  const insert = async (item: SvgIconItem, button: HTMLButtonElement) => {
    const element = button.querySelector<SVGSVGElement>('svg[data-library-icon]');
    if (disabled || busy || !element || signal.aborted) return;
    setBusy(item.id); setError('');
    try {
      // Rasterize only our bundled icon; projects store pixels, never arbitrary SVG markup.
      const image = await decodeLocalImage(svgDataUrl(serializeIconSvg(element, item.name, 800)));
      if (signal.aborted) return;
      const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 800;
      const context = canvas.getContext('2d'); if (!context) throw new Error('Nie udało się przygotować ikony.');
      context.drawImage(image, 0, 0, 800, 800);
      const inlinePng = canvas.toDataURL('image/png');
      await onChoose({ id: `icon-${item.id}`, name: item.name, src: '', thumbnail: inlinePng, inlinePng, category: item.category });
    } catch (reason) { if (!signal.aborted) setError(reason instanceof Error ? reason.message : 'Nie udało się wstawić ikony.'); }
    finally { if (!signal.aborted) setBusy(''); }
  };
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <Input aria-label="Szukaj ikon do karuzeli" placeholder="Szukaj: webinar, pinezka, kontakt, AI…" value={search} onChange={event => { setSearch(event.target.value); setVisible(48); }}/>
    <div className="grid grid-cols-2 gap-3"><SvgColorInput id="carousel-icon-color" label="Kolor ikony" value={color} onChange={setColor}/><div className="space-y-2"><label htmlFor="carousel-icon-stroke" className="text-sm font-medium">Grubość linii: {stroke}</label><input id="carousel-icon-stroke" type="range" min="1" max="4" step="0.5" value={stroke} onChange={event => setStroke(Number(event.target.value))} className="h-10 w-full accent-primary"/></div></div>
    <div className="flex min-w-0 gap-2"><Button variant={onlyFavorites ? 'default' : 'outline'} aria-pressed={onlyFavorites} onClick={() => { setOnlyFavorites(!onlyFavorites); setVisible(48); }} className="h-11 gap-1 px-2 text-xs"><Star className="h-4 w-4"/>Ulubione</Button><select aria-label="Kategoria ikon do karuzeli" value={category} onChange={event => { setCategory(event.target.value); setVisible(48); }} className="h-11 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"><option value="all">Wszystkie kategorie</option>{[...new Set(SVG_ICONS.map(item => item.category))].map(value => <option key={value}>{value}</option>)}</select></div>
    <p role="status" className="text-xs text-muted-foreground">{items.length} ikon · Kliknij, aby wstawić. Zmienisz położenie, rozmiar i obrót na slajdzie. Bez kredytów.</p>
    {disabled && <p className="text-xs text-destructive">Limit: 16 elementów na slajdzie, w tym 8 obrazów. Usuń obraz, aby dodać ikonę.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1" aria-label="Ikony do karuzeli"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{items.slice(0, visible).map(item => <div key={item.id} className="relative min-w-0 rounded-xl border bg-card p-2">
      <button type="button" aria-label={`${favorites.has(item.id) ? 'Usuń z' : 'Dodaj do'} ulubionych: ${item.name}`} aria-pressed={favorites.has(item.id)} onClick={() => favorites.toggle(item.id)} className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full text-primary focus-visible:ring-2 focus-visible:ring-primary"><Star className={`h-4 w-4 ${favorites.has(item.id) ? 'fill-current' : ''}`}/></button>
      <button type="button" aria-label={`Wstaw ikonę: ${item.name}`} disabled={disabled || Boolean(busy)} onClick={event => void insert(item, event.currentTarget)} className="flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-lg px-1 pt-8 text-center text-xs hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40">{busy === item.id ? <Loader2 className="h-10 w-10 animate-spin"/> : <item.icon data-library-icon size={40} color={color} strokeWidth={stroke}/>}<span className="break-words">{item.name}</span></button>
    </div>)}</div>{items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Brak pasujących ikon. Zmień wyszukiwanie lub wyłącz filtr ulubionych.</p>}{items.length > visible && <Button variant="outline" className="mt-3 h-11 w-full" onClick={() => setVisible(value => value + 48)}>Pokaż więcej ikon</Button>}</div>
    <p className="text-[10px] text-muted-foreground">Ulubione zapisują się na tym urządzeniu. Ikony Lucide, licencje ISC / MIT. Użycie komercyjne dozwolone.</p>
  </div>;
}
