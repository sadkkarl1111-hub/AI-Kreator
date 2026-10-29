import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Shapes, Search, SlidersHorizontal, Star } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SvgColorInput, SvgExportActions } from '@/components/SvgControls';
import { SVG_ICONS, filterSvgIcons, normalizeSvgSearch, type SvgIconItem } from '@/lib/svgCatalog';
import { DEFAULT_SVG_OPTIONS, SVG_STYLES, downloadSvg, generateSvg, serializeIconSvg, svgDataUrl } from '@/lib/svgTools';
import { useLocalAssetFavorites } from '@/hooks/useLocalAssetFavorites';

export default function SvgLibrary() {
  const [search, setSearch] = useState('');
  const favorites = useLocalAssetFavorites('icons');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [visible, setVisible] = useState(60);
  const [category, setCategory] = useState('all');
  const [iconColor, setIconColor] = useState('#7c3aed');
  const [stroke, setStroke] = useState(2);
  const [size, setSize] = useState(256);
  const [selected, setSelected] = useState<SvgIconItem | null>(null);
  const preview = useRef<SVGSVGElement>(null);
  const categories = [...new Set(SVG_ICONS.map(icon => icon.category))];
  const icons = filterSvgIcons(search, category).filter(item => !onlyFavorites || favorites.has(item.id));
  const graphics = SVG_STYLES.filter(style => normalizeSvgSearch(`${style.name} ${style.category}`).includes(normalizeSvgSearch(search)));
  const getSelectedSvg = () => {
    if (!preview.current || !selected) throw new Error('Wybierz ikonę');
    return serializeIconSvg(preview.current, selected.name, size);
  };

  return <AppLayout><main className="mx-auto max-w-6xl min-w-0 space-y-6">
    <div className="flex items-start gap-2 sm:gap-3">
      <Button asChild variant="ghost" size="icon" className="shrink-0"><Link to="/tools" aria-label="Wróć do narzędzi"><ArrowLeft className="h-4 w-4" /></Link></Button>
      <div className="min-w-0"><h1 className="text-2xl font-bold sm:text-3xl"><Shapes className="mr-2 inline h-6 w-6 text-primary" />Biblioteka <span className="gradient-text">SVG</span></h1><p className="mt-1 text-sm text-muted-foreground">{SVG_ICONS.length} ikon i {SVG_STYLES.length} prostych grafik. Pobieraj bez konta i kredytów.</p></div>
    </div>
    <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Szukaj ikon i grafik SVG" placeholder="Szukaj: serce, dostawa, strzałka, góry…" value={search} onChange={event => { setSearch(event.target.value); setVisible(60); }} className="h-11 pl-10" /></div>

    <Tabs defaultValue="icons" className="space-y-5">
      <TabsList className="h-11 w-full sm:w-auto"><TabsTrigger value="icons" className="h-9 flex-1 px-5">Ikony ({SVG_ICONS.length})</TabsTrigger><TabsTrigger value="graphics" className="h-9 flex-1 px-5">Grafiki ({SVG_STYLES.length})</TabsTrigger></TabsList>
      <TabsContent value="icons" className="space-y-5">
        <Card><CardContent className="grid items-end gap-4 p-4 sm:grid-cols-3">
          <SvgColorInput id="icon-color" label="Kolor ikon" value={iconColor} onChange={setIconColor} />
          <div className="space-y-2"><Label htmlFor="icon-stroke">Grubość linii: {stroke}</Label><input id="icon-stroke" className="h-11 w-full accent-primary" type="range" min="1" max="4" step="0.5" value={stroke} onChange={event => setStroke(Number(event.target.value))} /></div>
          <div className="space-y-2"><Label htmlFor="icon-size">Rozmiar pliku</Label><select id="icon-size" value={size} onChange={event => setSize(Number(event.target.value))} className="h-11 w-full rounded-md border bg-background px-3 text-sm">{[64, 128, 256, 512, 1024].map(value => <option key={value} value={value}>{value} × {value} px</option>)}</select></div>
        </CardContent></Card>
        <div className="flex flex-wrap gap-2" aria-label="Kategorie ikon"><select aria-label="Kategoria ikon SVG" value={category} onChange={event => { setCategory(event.target.value); setVisible(60); }} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm sm:hidden"><option value="all">Wszystkie kategorie</option>{categories.map(value => <option key={value}>{value}</option>)}</select><Button size="sm" variant={onlyFavorites ? 'default' : 'outline'} aria-pressed={onlyFavorites} onClick={() => { setOnlyFavorites(!onlyFavorites); setVisible(60); }}><Star className="mr-1 h-4 w-4"/>Ulubione</Button><Button size="sm" className="hidden sm:inline-flex" variant={category === 'all' ? 'default' : 'outline'} onClick={() => { setCategory('all'); setVisible(60); }}>Wszystkie</Button>{categories.map(value => <Button key={value} size="sm" className="hidden sm:inline-flex" variant={category === value ? 'default' : 'outline'} onClick={() => { setCategory(value); setVisible(60); }}>{value}</Button>)}</div>
        <p className="text-xs text-muted-foreground" role="status">Znaleziono {icons.length} ikon. Kliknij ikonę, aby ją powiększyć lub zapisać jako PNG. Gwiazdka zapisuje ulubione na tym urządzeniu; znajdziesz je również w karuzelach.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {icons.slice(0, visible).map(item => <article key={item.id} className="relative flex min-w-0 flex-col rounded-xl border bg-card p-3 shadow-sm transition hover:border-primary/50">
            <button type="button" aria-label={`${favorites.has(item.id) ? 'Usuń z' : 'Dodaj do'} ulubionych: ${item.name}`} aria-pressed={favorites.has(item.id)} onClick={() => favorites.toggle(item.id)} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary"><Star className={`h-4 w-4 ${favorites.has(item.id) ? 'fill-current' : ''}`}/></button>
            <button type="button" aria-label={`Dostosuj: ${item.name}`} onClick={() => setSelected(item)} className="flex min-h-28 flex-1 pt-8 flex-col items-center justify-center gap-3 rounded-md py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary"><item.icon data-library-icon size={48} color={iconColor} strokeWidth={stroke} /><span className="w-full break-words text-center text-xs font-medium">{item.name}</span></button>
            <Button variant="outline" className="mt-2 h-11 w-full min-w-0 gap-1 px-1 text-xs" onClick={event => {
              const element = event.currentTarget.closest('article')?.querySelector<SVGSVGElement>('svg[data-library-icon]');
              if (element) downloadSvg(serializeIconSvg(element, item.name, size), `ikona-${item.id}`);
            }}><Download className="h-3.5 w-3.5" />Pobierz SVG</Button>
          </article>)}
        </div>
        {icons.length > visible && <Button variant="outline" className="h-11 w-full" onClick={() => setVisible(value => value + 60)}>Pokaż więcej ikon ({icons.length - visible})</Button>}
        {icons.length === 0 && <div className="space-y-3 py-10 text-center"><p className="text-muted-foreground">Brak pasujących ikon. Spróbuj innego słowa.</p><Button variant="outline" onClick={() => { setSearch(''); setCategory('all'); }}>Pokaż wszystkie ikony</Button></div>}
        <p className="text-xs leading-relaxed text-muted-foreground">Ikony: <a href="https://lucide.dev/license" target="_blank" rel="noopener noreferrer" className="underline">Lucide, licencje ISC / MIT</a>. Dozwolone użycie komercyjne. Informacja o licencji jest dołączona do pobieranego SVG.</p>
      </TabsContent>

      <TabsContent value="graphics" className="space-y-4">
        <p className="text-sm text-muted-foreground">Pobierz gotową grafikę albo otwórz ją w generatorze, aby zmienić kolory, rozmiar i tło.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {graphics.map(style => {
            const svg = generateSvg({ ...DEFAULT_SVG_OPTIONS, style: style.id });
            return <Card key={style.id} className="min-w-0"><CardContent className="flex h-full flex-col gap-3 p-3"><img src={svgDataUrl(svg)} alt={style.name} loading="lazy" className="aspect-[3/2] w-full rounded-lg border object-cover" /><div><p className="text-sm font-medium">{style.name}</p><p className="text-xs text-muted-foreground">{style.category}</p></div><div className="mt-auto grid gap-2"><Button className="h-11 min-w-0 gap-1 px-2 text-xs" onClick={() => downloadSvg(svg, `grafika-${style.id}`)}><Download className="h-4 w-4" />Pobierz SVG</Button><Button asChild variant="outline" className="h-11 min-w-0 gap-1 px-2 text-xs"><Link to={`/tools/svg-generator?style=${style.id}`}><SlidersHorizontal className="h-4 w-4" />Dostosuj</Link></Button></div></CardContent></Card>;
          })}
        </div>
        {graphics.length === 0 && <p className="py-10 text-center text-muted-foreground">Brak pasujących grafik. Spróbuj innego słowa.</p>}
      </TabsContent>
    </Tabs>

    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
        {selected && <><div className="flex h-48 items-center justify-center rounded-lg border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"><selected.icon ref={preview} size={120} color={iconColor} strokeWidth={stroke} /></div><SvgColorInput id="selected-icon-color" label="Kolor ikony" value={iconColor} onChange={setIconColor} /><SvgExportActions svg={getSelectedSvg} name={`ikona-${selected.id}`} /><p className="text-xs text-muted-foreground">Przezroczyste tło · {size} × {size} px · Lucide ISC / MIT</p></>}
      </DialogContent>
    </Dialog>
  </main></AppLayout>;
}
