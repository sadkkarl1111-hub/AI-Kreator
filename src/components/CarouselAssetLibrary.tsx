import { badgeIsNew } from '@/lib/badgeLibraryView';
import { CarouselIconPicker } from './CarouselIconPicker';
import { useLocalAssetFavorites } from '@/hooks/useLocalAssetFavorites';
import { normalizeSvgSearch } from '@/lib/svgCatalog';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Award, Smile, Loader2, Lock, RefreshCw, Shapes, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { vpsFetch, vpsPublicFetch } from '@/lib/vpsApi';
import { filterEmojiCategories, mergeEmojiCategories } from '@/lib/emojiCatalog';
import { validCarouselEmoji } from '@/lib/carouselStickers';
import { carouselLibraryBadges, carouselLibraryGallery, type CarouselBadgeResponse, type CarouselGalleryResponse, type CarouselImageTarget, type CarouselLibraryImage, type CarouselLibrarySource } from '@/lib/carouselLibrary';

const CAROUSEL_LIBRARY_TABS = [
  { id: 'gallery' as const, label: 'Moje grafiki', icon: ImagePlus },
  { id: 'badges' as const, label: 'Badge’e', icon: Award },
  { id: 'emoji' as const, label: 'Emoji', icon: Smile },
  { id: 'icons' as const, label: 'Ikony', icon: Shapes },
];

export function CarouselAssetLibrary({ source, onClose, onImage, onEmoji, canAddElement, canAddImage }: { source: CarouselLibrarySource; onClose: () => void; onImage: (image: CarouselLibraryImage, target: CarouselImageTarget, signal: AbortSignal) => Promise<void>; onEmoji: (emoji: string) => void; canAddElement: boolean; canAddImage: boolean }) {
  const { user } = useAuth();
  const badgeFavorites = useLocalAssetFavorites('badges');
  const [onlyBadgeFavorites, setOnlyBadgeFavorites] = useState(false);
  const userId = user?.id;
  const [tab, setTab] = useState(source), [query, setQuery] = useState(''), [category, setCategory] = useState('all');
  const [images, setImages] = useState<CarouselLibraryImage[]>([]), [adminEmoji, setAdminEmoji] = useState<{ label: string; emojis: string[] }[]>([]), [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [reload, setReload] = useState(0), [visible, setVisible] = useState(24);
  const [target, setTarget] = useState<CarouselImageTarget>('element'), [inserting, setInserting] = useState(''), [broken, setBroken] = useState<Set<string>>(new Set());
  const [insertion] = useState(() => new AbortController());
  useEffect(() => () => insertion.abort(), [insertion]);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setImages([]); setAdminEmoji([]); setFavorites([]); setError(''); setBroken(new Set());
      if (tab === 'icons' || (!userId && tab !== 'badges')) { setLoading(false); return; }
      setLoading(true);
      try {
        if (tab === 'gallery') {
          const data = await vpsFetch<CarouselGalleryResponse>('/gallery?filter=generated&limit=200', { signal: controller.signal });
          if (!controller.signal.aborted) setImages(carouselLibraryGallery(data));
        } else if (tab === 'badges') {
          const data = await (userId ? vpsFetch : vpsPublicFetch)<CarouselBadgeResponse>('/assets/badges/library', { signal: controller.signal, cache: 'no-store' });
          if (!controller.signal.aborted) setImages(carouselLibraryBadges(data));
        } else {
          const data = await vpsFetch<{ ok?: boolean; error?: string; favorites?: string[]; adminCategories?: { label: string; emojis: string[] }[] }>('/assets/emojis/library', { signal: controller.signal });
          if (data.ok === false || data.error) throw new Error(data.error || 'Nie udało się pobrać emoji.');
          if (!controller.signal.aborted) { setAdminEmoji(data.adminCategories || []); setFavorites(data.favorites || []); }
        }
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Nie udało się pobrać biblioteki.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [tab, userId, reload]);
  useEffect(() => { const refresh = () => { if (document.visibilityState === 'visible' && !inserting) setReload(value => value + 1); }; window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, [inserting]);
  const categories = mergeEmojiCategories(adminEmoji);
  const emojiItems = [...new Set(filterEmojiCategories(categories, query, category === 'favorites' ? 'all' : category).flatMap(item => item.emojis))].filter(item => validCarouselEmoji(item) && (category !== 'favorites' || favorites.includes(item)));
  const filteredImages = images.filter(item => (category === 'all' || (tab === 'badges' && category === 'new' ? badgeIsNew(item) : item.category === category)) && (tab !== 'badges' || !onlyBadgeFavorites || badgeFavorites.has(item.id)) && normalizeSvgSearch(query).split(/\s+/).every(word => normalizeSvgSearch(`${item.name} ${item.description || ''} ${item.category || ''}`).includes(word)));
  const imageDisabled = !canAddImage && (tab !== 'gallery' || target === 'element');
  const selectImage = async (image: CarouselLibraryImage) => {
    if (inserting || image.locked || imageDisabled) return;
    setInserting(image.id); setError('');
    try { await onImage(image, tab === 'gallery' ? target : 'element', insertion.signal); if (!insertion.signal.aborted) onClose(); }
    catch (reason) { if (!insertion.signal.aborted) setError(reason instanceof Error ? reason.message : 'Nie udało się wstawić grafiki.'); }
    finally { if (!insertion.signal.aborted) setInserting(''); }
  };
  const changeTab = (value: CarouselLibrarySource) => { setTab(value); setQuery(''); setCategory('all'); setVisible(24); };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="flex max-h-[90svh] w-[calc(100%-1rem)] max-w-4xl flex-col gap-3 rounded-xl p-4 sm:p-6">
    <DialogHeader className="pr-6 text-left"><DialogTitle>Dodaj do karuzeli</DialogTitle><DialogDescription>Twoje grafiki, badge’e, emoji i kolorowe ikony — bez ponownego generowania i bez kredytów.</DialogDescription></DialogHeader>
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4" aria-label="Źródło elementów">{CAROUSEL_LIBRARY_TABS.map(({ id, label, icon: Icon }) => <Button key={id} variant={tab === id ? 'default' : 'outline'} disabled={Boolean(inserting)} aria-pressed={tab === id} className="h-11 gap-1 px-1 text-xs sm:text-sm" onClick={() => changeTab(id)}><Icon className="h-4 w-4 shrink-0"/>{label}</Button>)}</div>
    {tab === 'icons' ? <><CarouselIconPicker onChoose={selectImage} disabled={imageDisabled || Boolean(inserting)} signal={insertion.signal}/>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</> : tab === 'gallery' && !user ? <div className="space-y-3 rounded-lg border bg-muted/30 p-6 text-center"><ImagePlus className="mx-auto h-8 w-8 text-primary"/><p>Zaloguj się, aby wstawić grafiki wygenerowane na Twoim koncie.</p><Button asChild><Link to="/auth?returnTo=/tools/carousel">Zaloguj się</Link></Button></div> : <>
      <div className="flex min-w-0 gap-2"><Input aria-label="Szukaj w bibliotece karuzeli" placeholder={tab === 'emoji' ? 'Szukaj: ogień, serce, biznes…' : 'Szukaj grafiki…'} value={query} disabled={Boolean(inserting)} onChange={event => { setQuery(event.target.value); setVisible(24); }} className="min-w-0 flex-1"/>{tab !== 'gallery' && <select aria-label="Kategoria biblioteki karuzeli" value={category} disabled={Boolean(inserting)} onChange={event => { setCategory(event.target.value); setVisible(24); }} className="h-10 w-[42%] min-w-0 rounded-md border bg-background px-2 text-xs"><option value="all">Wszystkie kategorie</option>{tab === 'emoji' ? <>{favorites.length > 0 && <option value="favorites">⭐ Ulubione</option>}{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</> : <>{tab === 'badges' && <option value="new">Nowe badge’e ({images.filter(image => badgeIsNew(image)).length})</option>}{[...new Set(images.map(item => item.category).filter(Boolean))].map(name => <option key={name} value={name}>{name}</option>)}</>}</select>}</div>
      {tab === 'badges' && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Najnowsze na początku · {Math.min(visible, filteredImages.length)} z {filteredImages.length} badge’ów</span>{filteredImages.length > visible && <Button size="sm" variant="outline" className="h-10" onClick={() => setVisible(filteredImages.length)}>Pokaż wszystkie badge’e</Button>}</div>}
      {tab === 'badges' && <Button variant={onlyBadgeFavorites ? 'default' : 'outline'} aria-pressed={onlyBadgeFavorites} className="h-10 self-start gap-1" onClick={() => { setOnlyBadgeFavorites(!onlyBadgeFavorites); setVisible(24); }}><Star className="h-4 w-4"/>Ulubione badge’e</Button>}
      {tab === 'gallery' && <div className="space-y-1"><label htmlFor="carousel-gallery-target" className="text-xs font-medium">Jak wstawić grafikę?</label><select id="carousel-gallery-target" value={target} disabled={Boolean(inserting)} onChange={event => setTarget(event.target.value as CarouselImageTarget)} className="h-10 w-full rounded-md border bg-background px-2 text-sm"><option value="element">Ruchomy element na slajdzie</option><option value="photo">Zdjęcie slajdu · zastępuje obecne zdjęcie</option><option value="background">Tło wszystkich slajdów · zastępuje obecne tło</option></select><p className="text-xs text-muted-foreground">Wybierz miniaturę. Zmianę możesz cofnąć.</p></div>}
      {(tab === 'emoji' ? !canAddElement : imageDisabled) && <p className="text-xs text-destructive">Limit: 16 elementów na slajdzie, w tym 8 obrazów. Usuń element lub wybierz zdjęcie / tło.</p>}
      {loading && <p role="status" className="flex items-center gap-2 py-4 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>Wczytuję bibliotekę…</p>}
      {error && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 p-2 text-sm"><span className="flex-1">{error}</span><Button variant="outline" size="sm" disabled={Boolean(inserting)} onClick={() => setReload(value => value + 1)}>Spróbuj ponownie</Button></div>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1" aria-label="Zawartość biblioteki karuzeli">
        {tab === 'emoji' ? <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">{emojiItems.slice(0, visible * 4).map(emoji => <button key={emoji} type="button" disabled={!canAddElement || Boolean(inserting)} aria-label={`Wstaw emoji ${emoji}`} title={`Wstaw ${emoji}`} onClick={() => { onEmoji(emoji); onClose(); }} className="flex h-14 items-center justify-center rounded-lg border bg-muted/30 text-3xl hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40">{emoji}</button>)}</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{filteredImages.slice(0, visible).map(image => <div key={image.id} className="relative min-w-0"><button type="button" disabled={Boolean(inserting) || imageDisabled || image.locked || broken.has(image.id)} aria-label={`Wstaw ${tab === 'badges' ? 'badge' : 'grafikę'}: ${image.name}`} onClick={() => void selectImage(image)} className="group h-full w-full min-w-0 overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">
          <div className="relative flex aspect-[4/3] items-center justify-center bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:14px_14px] p-2"><img src={image.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false} onError={() => setBroken(previous => new Set([...previous, image.id]))} className="h-full w-full object-contain"/>{inserting === image.id && <Loader2 className="absolute h-8 w-8 animate-spin text-primary"/>}{image.locked && <Lock className="absolute left-2 top-2 h-5 w-5 rounded bg-background/90 p-0.5"/>}</div><div className="space-y-1 p-2"><p className="line-clamp-2 text-xs font-medium">{image.name}</p>{image.locked && <p className="text-[10px] text-muted-foreground">Pakiet: {image.requiredPackages?.join(' / ')}</p>}{broken.has(image.id) && <p className="text-[10px] text-destructive">Obraz niedostępny</p>}</div>
        </button>{tab === 'badges' && <button type="button" aria-label={`${badgeFavorites.has(image.id) ? 'Usuń z' : 'Dodaj do'} ulubionych: ${image.name}`} aria-pressed={badgeFavorites.has(image.id)} onClick={() => badgeFavorites.toggle(image.id)} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background/95 text-primary shadow-sm focus-visible:ring-2 focus-visible:ring-primary"><Star className={`h-4 w-4 ${badgeFavorites.has(image.id) ? 'fill-current' : ''}`}/></button>}</div>)}</div>}
        {!loading && !(tab === 'emoji' ? emojiItems.length : filteredImages.length) && <p className="py-8 text-center text-sm text-muted-foreground">{tab === 'gallery' && !images.length ? 'Nie masz jeszcze zapisanych wygenerowanych grafik.' : 'Brak wyników. Zmień wyszukiwanie lub kategorię.'}</p>}
        {(tab === 'emoji' ? emojiItems.length > visible * 4 : filteredImages.length > visible) && <Button variant="outline" className="mt-3 h-11 w-full" onClick={() => setVisible(value => value + 24)}>Pokaż więcej</Button>}
      </div>
      {tab !== 'emoji' && <Button variant="ghost" className="h-9 shrink-0 gap-2 text-xs" disabled={loading || Boolean(inserting)} onClick={() => setReload(value => value + 1)}><RefreshCw className="h-3 w-3"/>Odśwież bibliotekę</Button>}
    </>}
  </DialogContent></Dialog>;
}
