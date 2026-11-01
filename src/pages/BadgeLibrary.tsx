import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Award, ArrowLeft, Search, Download, Lock, Pencil, Star, Sparkles, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { vpsFetch, vpsPublicFetch } from '@/lib/vpsApi';
import { BADGE_CATALOG } from '@/lib/badgeCatalog';
import { normalizeSvgSearch } from '@/lib/svgCatalog';
import { useLocalAssetFavorites } from '@/hooks/useLocalAssetFavorites';
import { badgeIsNew, newestBadgesFirst } from '@/lib/badgeLibraryView';
import { badgeAppearance, BADGE_LOOKS } from '@/lib/badgeAppearance';

type BadgeItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  src: string;
  addedAt?: string;
  style?: string;
  color?: string;
  colors?: string[];
  look?: string;
};

type BadgeAccessEntry = {
  badge_key: string;
  package_id: string;
};

type BadgeLibraryResponse = {
  ok?: boolean;
  hiddenKeys?: string[];
  badges?: BadgeItem[];
  access?: BadgeAccessEntry[];
  packages?: Array<{ id: string; label: string }>;
  purchasedPackageIds?: string[];
  error?: string;
};

const STATIC_BADGES: BadgeItem[] = BADGE_CATALOG;

const BadgeLibrary = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const favorites = useLocalAssetFavorites('badges');
  const [params, setParams] = useSearchParams();
  const view = params.get('view');
  const activeLook = BADGE_LOOKS.some(look => look.id === params.get('look')) ? params.get('look') || '' : '';
  const onlyFavorites = view === 'favorites', onlyNew = view === 'new';
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeStyle, setActiveStyle] = useState('');
  const [activeColor, setActiveColor] = useState('');
  const [allBadges, setAllBadges] = useState<BadgeItem[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [badgeAccess, setBadgeAccess] = useState<BadgeAccessEntry[]>([]);
  const [userPurchasedPackages, setUserPurchasedPackages] = useState<string[]>([]);
  const [packageLabels, setPackageLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    const fetchAll = async () => {
      setLoadingBadges(true);
      setLoadError(null);
      setAllBadges([]);
      try {
        const fetchLibrary = user ? vpsFetch : vpsPublicFetch;
        const data = await fetchLibrary<BadgeLibraryResponse>('/assets/badges/library', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (controller.signal.aborted) return;
        if (data.error || data.ok === false) throw new Error(data.error || 'Nie udało się pobrać badge’ów');
        const hiddenKeys = data.hiddenKeys || [];
        const visibleStatic = STATIC_BADGES.filter(b => !hiddenKeys.includes(b.id));

        setBadgeAccess(data.access || []);
        setAllBadges(newestBadgesFirst([...new Map([...visibleStatic, ...(data.badges || []).filter(b => !hiddenKeys.includes(b.id))].map(b => [b.id, b])).values()].map(badge => ({ ...badge, ...badgeAppearance(badge) }))));

        const labels: Record<string, string> = {};
        (data.packages || []).forEach(p => { labels[p.id] = p.label; });
        setPackageLabels(labels);
        setUserPurchasedPackages(data.purchasedPackageIds || []);
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Nie udało się pobrać badge’ów';
        setLoadError(message);
        toast.error(message);
      } finally {
        if (!controller.signal.aborted) setLoadingBadges(false);
      }
    };
    void fetchAll();
    return () => controller.abort();
  }, [user, reloadKey]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setReloadKey(key => key + 1);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const categories = [...new Set(allBadges.map(b => b.category))];
  const lookBadges = allBadges.filter(b => !activeLook || b.look === activeLook);
  const styles = [...new Set(lookBadges.map(b => b.style).filter(Boolean))];
  const colors = [...new Set(lookBadges.flatMap(b => b.colors || [b.color]).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'pl'));

  const isBadgeLocked = (badgeId: string): boolean => {
    const accessEntries = badgeAccess.filter(a => a.badge_key === badgeId);
    if (accessEntries.length === 0) return false; // No restrictions = available for all
    // Check if user purchased any of the required packages
    return !accessEntries.some(a => userPurchasedPackages.includes(a.package_id));
  };

  const getRequiredPackages = (badgeId: string): string[] => {
    return badgeAccess
      .filter(a => a.badge_key === badgeId)
      .map(a => packageLabels[a.package_id])
      .filter(Boolean);
  };

  const filtered = allBadges.filter(b => {
    const matchSearch = normalizeSvgSearch(search).split(/\s+/).every(word => normalizeSvgSearch(`${b.name} ${b.description} ${b.category} ${b.style || ''} ${b.color || ''} ${BADGE_LOOKS.find(look => look.id === b.look)?.label || ''}`).includes(word));
    const matchCat = !activeCategory || b.category === activeCategory;
    return matchSearch && matchCat && (!activeLook || b.look === activeLook) && (!activeStyle || b.style === activeStyle) && (!activeColor || b.colors?.includes(activeColor) || b.color === activeColor) && (!onlyFavorites || favorites.has(b.id)) && (!onlyNew || badgeIsNew(b));
  });
  const newCount = allBadges.filter(badge => badgeIsNew(badge)).length;
  const chooseView = (next: 'all' | 'new' | 'favorites') => {
    setParams(next === 'all' ? {} : { view: next }, { replace: true });
    setSearch(''); setActiveCategory(null); setActiveStyle(''); setActiveColor('');
  };
  const chooseLook = (look: string) => {
    const next = new URLSearchParams(params);
    if (look === activeLook) next.delete('look'); else next.set('look', look);
    setParams(next, { replace: true });
    setActiveStyle(''); setActiveColor(''); setActiveCategory(null); setSearch('');
  };

  const handleDownload = async (badge: BadgeItem) => {
    if (isBadgeLocked(badge.id)) {
      toast.error('Ten badge wymaga zakupu odpowiedniego pakietu kredytów');
      return;
    }
    try {
      const res = await fetch(badge.src);
      if (!res.ok) throw new Error('Nie udało się pobrać');
      const blob = await res.blob();
      const extension = blob.type.includes('webp')
        ? 'webp'
        : blob.type.includes('svg')
          ? 'svg'
          : 'png';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `badge-${badge.id}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${badge.name} pobrane!`);
    } catch {
      toast.error('Nie udało się pobrać');
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start gap-2 sm:gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">
              <Award className="inline w-6 h-6 text-primary mr-2" />
              Baza <span className="gradient-text">badge'ów</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Gotowe badge’e z przezroczystym tłem do pobrania i edycji AI. Część wymaga zakupu pakietu.</p>
          </div>
        </div>

        <section aria-label="Wybierz wygląd badge’ów" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Wybierz wygląd</h2><p className="text-xs text-muted-foreground">Także starsze grafiki są podzielone według stylu</p></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {BADGE_LOOKS.filter(look => look.id !== 'other' || allBadges.some(badge => badge.look === 'other')).map(look => {
              const items = allBadges.filter(badge => badge.look === look.id);
              const preview = items.find(badge => !isBadgeLocked(badge.id));
              return <button key={look.id} type="button" aria-label={look.label} aria-pressed={activeLook === look.id} onClick={() => chooseLook(look.id)} className={`flex min-w-0 flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4 ${activeLook === look.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}>
                <div className="flex h-16 w-full items-center justify-between gap-2">{preview ? <img src={preview.src} alt="" width="76" height="64" loading="lazy" className="h-16 w-20 object-contain" /> : <Award aria-hidden="true" className="h-8 w-8 text-muted-foreground" />}<span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold" aria-hidden="true">{items.length}</span></div>
                <span className="text-sm font-semibold sm:text-base">{look.label}</span><span className="text-xs leading-5 text-muted-foreground">{look.description}</span>
              </button>;
            })}
          </div>
        </section>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj badge'ów..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant={onlyNew ? 'default' : 'outline'} size="sm" aria-pressed={onlyNew} onClick={() => chooseView(onlyNew ? 'all' : 'new')}><Sparkles className="mr-1 h-4 w-4"/>Nowe<span aria-hidden="true" className="ml-1">({newCount})</span></Button>
          <Button variant={onlyFavorites ? 'default' : 'outline'} size="sm" aria-pressed={onlyFavorites} onClick={() => chooseView(onlyFavorites ? 'all' : 'favorites')}><Star className="mr-1 h-4 w-4"/>Ulubione</Button>
          <Button
            variant={!activeLook && !activeCategory && !activeStyle && !activeColor && !onlyFavorites && !onlyNew && !search ? 'default' : 'outline'}
            size="sm"
            onClick={() => chooseView('all')}
          >
            Wszystkie
          </Button>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Kategorie badge’ów">
          <select aria-label="Kategoria badge’ów" value={activeCategory || ''} onChange={event => setActiveCategory(event.target.value || null)} className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm sm:hidden"><option value="">Wszystkie kategorie</option>{categories.map(cat => <option key={cat} value={cat}>{cat} ({allBadges.filter(badge => badge.category === cat).length})</option>)}</select>
          {categories.map(cat => (
            <Button
              key={cat}
              className="hidden sm:inline-flex"
              variant={activeCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        {(styles.length > 0 || colors.length > 0) && <div className="grid gap-3 sm:grid-cols-2" aria-label="Wygląd badge’ów">
          <label className="min-w-0 space-y-1 text-sm font-medium"><span>Styl</span><select aria-label="Styl badge’ów" value={activeStyle} onChange={event => setActiveStyle(event.target.value)} className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm"><option value="">Wszystkie style</option>{styles.map(style => <option key={style} value={style}>{style}</option>)}</select></label>
          <label className="min-w-0 space-y-1 text-sm font-medium"><span>Kolor</span><select aria-label="Kolor badge’ów" value={activeColor} onChange={event => setActiveColor(event.target.value)} className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm"><option value="">Wszystkie kolory</option>{colors.map(color => <option key={color} value={color}>{color}</option>)}</select></label>
        </div>}

        <p className="text-xs text-muted-foreground">Kliknij gwiazdkę, aby zapisać ulubione na tym urządzeniu. Badge’e wstawisz też w kreatorze karuzel: Media → Badge’e.</p>

        {!loadingBadges && !loadError && <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-sm sm:top-16"><p role="status" className="text-sm">W bibliotece: <strong>{allBadges.length}</strong>. Wyświetlono: <strong>{filtered.length}</strong>. <span className="text-muted-foreground">{activeLook ? BADGE_LOOKS.find(look => look.id === activeLook)?.label : 'Wszystkie rodzaje'}. Najnowsze są na początku.</span></p><div className="flex flex-wrap gap-2">{(search || activeLook || activeCategory || activeStyle || activeColor || onlyFavorites || onlyNew) && <Button variant="outline" size="sm" className="h-10" onClick={() => chooseView('all')}>Pokaż wszystkie badge’e</Button>}<Button variant="ghost" size="sm" className="h-10 gap-1" onClick={() => setReloadKey(key => key + 1)}><RefreshCw className="h-4 w-4"/>Odśwież listę</Button></div></div>}

        {loadingBadges && <p role="status" className="text-center text-muted-foreground py-8">Ładowanie badge’ów...</p>}
        {loadError && (
          <div role="alert" className="space-y-3 text-center py-8">
            <p className="text-muted-foreground">{loadError}</p>
            <Button variant="outline" onClick={() => setReloadKey(key => key + 1)}>Spróbuj ponownie</Button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((badge, i) => {
            const locked = isBadgeLocked(badge.id);
            const requiredPkgs = getRequiredPackages(badge.id);
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i, 7) * 0.025 }}
                className="min-w-0 h-full"
              >
                <Card className={`group h-full hover:shadow-md transition-shadow ${locked ? 'opacity-70' : ''}`}>
                  <CardContent className="p-3 sm:p-4 h-full min-w-0 flex flex-col items-center gap-3">
                    <div className="relative w-full aspect-square flex items-center justify-center p-2 rounded-lg bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]">
                      <img
                        src={badge.src}
                        alt={badge.name}
                        loading={i < 4 ? 'eager' : 'lazy'}
                        decoding="async"
                        className={`max-w-full max-h-full object-contain drop-shadow-md ${locked ? 'blur-[2px] grayscale' : ''}`}
                      />
                      {locked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <button type="button" aria-label={`${favorites.has(badge.id) ? 'Usuń z' : 'Dodaj do'} ulubionych: ${badge.name}`} aria-pressed={favorites.has(badge.id)} onClick={() => favorites.toggle(badge.id)} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full border bg-background/95 text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Star className={`h-5 w-5 ${favorites.has(badge.id) ? 'fill-current' : ''}`}/></button>
                    </div>
                    <div className="text-center w-full break-words">
                      <div className="mb-1 flex flex-wrap justify-center gap-1">{badgeIsNew(badge) && <Badge className="text-[10px]">Nowość</Badge>}{badge.style && badge.style !== 'Inny' && <Badge variant="outline" className="text-[10px]">{badge.style}</Badge>}</div>
                      <p className="font-medium text-sm">{badge.name}</p>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                    </div>
                    {locked && requiredPkgs.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {requiredPkgs.map(pkg => (
                          <Badge key={pkg} variant="outline" className="text-[9px]">{pkg}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-auto grid grid-cols-1 gap-2 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-11 min-w-0 w-full gap-1.5 px-2 text-xs sm:text-sm"
                        onClick={() => handleDownload(badge)}
                        disabled={locked}
                      >
                        {locked ? (
                          <><Lock className="w-3.5 h-3.5" /> Dostęp</>
                        ) : (
                          <><Download className="w-3.5 h-3.5" /> Pobierz</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="h-11 min-w-0 w-full gap-1.5 px-2 text-xs sm:text-sm"
                        onClick={() => navigate(`/tools/badge-editor?badge=${encodeURIComponent(badge.id)}`)}
                        disabled={locked}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edytuj AI
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {!loadingBadges && !loadError && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Brak badge'ów pasujących do wyszukiwania</p>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default BadgeLibrary;
