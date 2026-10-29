import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Copy, Layers3, Search, Sparkles, Star, StarOff } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { vpsFetch } from '@/lib/vpsApi';
import { filterEmojiCategories, filterEmojiPacks, mergeEmojiCategories } from '@/lib/emojiCatalog';

type EmojiLibraryResponse = {
  ok?: boolean;
  error?: string;
  favorites?: string[];
  adminCategories?: { label: string; emojis: string[] }[];
};

const RECENT_KEY = 'adElementLibraryRecent';

const loadRecent = (): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, 20) : [];
  } catch {
    return [];
  }
};

export default function EmojiLibrary() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [recentlyCopied, setRecentlyCopied] = useState<string[]>(loadRecent);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [adminCategories, setAdminCategories] = useState<{ label: string; emojis: string[] }[]>([]);
  const [loading, setLoading] = useState(Boolean(user));

  const fetchLibrary = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setAdminCategories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await vpsFetch<EmojiLibraryResponse>('/assets/emojis/library');
      if (data?.error) throw new Error(data.error);
      setFavorites(data.favorites || []);
      setAdminCategories(data.adminCategories || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się pobrać elementów');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void fetchLibrary(); }, [fetchLibrary]);

  const categories = useMemo(() => mergeEmojiCategories(adminCategories), [adminCategories]);
  const filteredCategories = useMemo(() => filterEmojiCategories(categories, search, activeCategory), [activeCategory, categories, search]);
  const filteredPacks = useMemo(() => filterEmojiPacks(search), [search]);
  const resultCount = filteredCategories.reduce((sum, category) => sum + category.emojis.length, 0);
  const allCount = categories.reduce((sum, category) => sum + category.emojis.length, 0);

  const remember = (emoji: string) => {
    setRecentlyCopied(current => {
      const next = [emoji, ...current.filter(item => item !== emoji)].slice(0, 20);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const copyText = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message, { duration: 1500 });
      return true;
    } catch {
      toast.error('Nie udało się skopiować. Sprawdź uprawnienia przeglądarki.');
      return false;
    }
  };

  const copyEmoji = async (emoji: string) => {
    if (await copyText(emoji, `${emoji} skopiowane`)) remember(emoji);
  };

  const copyPack = async (label: string, emojis: string[]) => {
    if (await copyText(emojis.join(' '), `Zestaw „${label}” skopiowany`)) emojis.slice().reverse().forEach(remember);
  };

  const toggleFavorite = async (emoji: string) => {
    if (!user) {
      toast.error('Zaloguj się, aby zapisywać ulubione.');
      return;
    }
    const wasFavorite = favorites.includes(emoji);
    setFavorites(current => wasFavorite ? current.filter(item => item !== emoji) : [emoji, ...current]);
    try {
      await vpsFetch('/assets/emojis/favorites/toggle', { method: 'POST', body: JSON.stringify({ emoji, favorite: !wasFavorite }) });
      toast.success(wasFavorite ? 'Usunięto z ulubionych' : 'Dodano do ulubionych');
    } catch (error) {
      setFavorites(current => wasFavorite ? [emoji, ...current] : current.filter(item => item !== emoji));
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać ulubionych');
    }
  };

  const ElementButton = ({ emoji, source }: { emoji: string; source: string }) => {
    const isFavorite = favorites.includes(emoji);
    return <div className="group relative">
      <button type="button" onClick={() => void copyEmoji(emoji)} className="flex h-12 w-12 items-center justify-center rounded-xl border border-transparent bg-muted/50 text-2xl transition hover:scale-110 hover:border-primary/30 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" title={`Kopiuj ${emoji} — ${source}`} aria-label={`Kopiuj ${emoji}`}>
        {emoji}
      </button>
      <button type="button" onClick={() => void toggleFavorite(emoji)} className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background shadow-sm transition ${isFavorite ? 'text-amber-500' : 'text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`} title={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'} aria-label={isFavorite ? `Usuń ${emoji} z ulubionych` : `Dodaj ${emoji} do ulubionych`}>
        {isFavorite ? <Star className="h-3 w-3 fill-current" /> : <StarOff className="h-3 w-3" />}
      </button>
    </div>;
  };

  return <AppLayout>
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:py-9">
      <header className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-1 shrink-0"><Link to="/tools"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" />Elementy do postów i reklam</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Biblioteka <span className="gradient-text">elementów reklamowych</span></h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Znajdź checkmarki, strzałki, symbole i gotowe zestawy. Kliknij element, aby natychmiast go skopiować.</p>
        </div>
      </header>

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-sky-500/5">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><p className="font-semibold">Znajdź element po znaczeniu</p><p className="text-xs text-muted-foreground">Wpisz np. „pieniądze”, „kawa”, „webinar”, „ostrzeżenie” albo „CTA”.</p></div>
            <span className="text-xs text-muted-foreground">{allCount} elementów · {categories.length} kategorii</span>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={event => { setSearch(event.target.value); if (event.target.value.trim()) setActiveCategory('all'); }} placeholder="Czego szukasz?" className="h-12 bg-background pl-12 pr-24 text-base" />
            {search && <Button type="button" variant="ghost" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>Wyczyść</Button>}
          </div>
        </CardContent>
      </Card>

      {!!filteredPacks.length && <section className="space-y-3" aria-labelledby="packs-title">
        <div><h2 id="packs-title" className="flex items-center gap-2 text-xl font-bold"><Layers3 className="h-5 w-5 text-primary" />Gotowe paczki reklamowe</h2><p className="mt-1 text-sm text-muted-foreground">Skopiuj cały zestaw albo wybierz pojedynczy element.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredPacks.map(pack => <Card key={pack.id} className="overflow-hidden transition hover:border-primary/30 hover:shadow-md"><CardContent className="space-y-3 p-4">
            <div><p className="font-semibold">{pack.label}</p><p className="mt-1 text-xs text-muted-foreground">{pack.description}</p></div>
            <div className="flex flex-wrap gap-1">{pack.emojis.map((emoji, index) => <button key={`${emoji}-${index}`} type="button" onClick={() => void copyEmoji(emoji)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60 text-xl transition hover:scale-110 hover:bg-primary/10" title={`Kopiuj ${emoji}`}>{emoji}</button>)}</div>
            <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => void copyPack(pack.label, pack.emojis)}><Copy className="h-3.5 w-3.5" />Kopiuj paczkę</Button>
          </CardContent></Card>)}
        </div>
      </section>}

      {(favorites.length > 0 || recentlyCopied.length > 0) && <div className="grid gap-4 md:grid-cols-2">
        {favorites.length > 0 && <Card className="border-amber-400/30 bg-amber-400/5"><CardContent className="p-4"><p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-500" />Ulubione</p><div className="flex flex-wrap gap-1">{favorites.map(emoji => <ElementButton key={`fav-${emoji}`} emoji={emoji} source="ulubione" />)}</div></CardContent></Card>}
        {recentlyCopied.length > 0 && <Card><CardContent className="p-4"><div className="mb-3 flex items-center justify-between gap-2"><p className="text-sm font-semibold">Ostatnio używane</p><Button type="button" variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => void copyText(recentlyCopied.join(' '), 'Ostatnie elementy skopiowane')}><Copy className="h-3 w-3" />Kopiuj wszystkie</Button></div><div className="flex flex-wrap gap-1">{recentlyCopied.map(emoji => <ElementButton key={`recent-${emoji}`} emoji={emoji} source="ostatnio używane" />)}</div></CardContent></Card>}
      </div>}

      <section className="space-y-4" aria-labelledby="elements-title">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><h2 id="elements-title" className="text-xl font-bold">Wszystkie elementy</h2><p className="mt-1 text-sm text-muted-foreground">{search ? `Znaleziono: ${resultCount} elementów${filteredPacks.length ? ` · paczki: ${filteredPacks.length}` : ''}` : 'Filtruj według zastosowania.'}</p></div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap" role="group" aria-label="Kategorie elementów">
            <Button size="sm" variant={activeCategory === 'all' ? 'default' : 'outline'} onClick={() => setActiveCategory('all')}>Wszystkie</Button>
            {categories.map(category => <Button key={category.id} size="sm" variant={activeCategory === category.id ? 'default' : 'outline'} className="shrink-0" onClick={() => setActiveCategory(category.id)}>{category.label}</Button>)}
          </div>
        </div>

        {loading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Wczytujemy Twoją bibliotekę…</CardContent></Card>
          : filteredCategories.length ? <div className="grid gap-4 md:grid-cols-2">
            {filteredCategories.map((category, index) => <motion.div key={category.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.025, 0.2) }}><Card className="h-full"><CardContent className="p-4 sm:p-5"><div className="mb-3"><p className="font-semibold">{category.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{category.description}</p></div><div className="flex flex-wrap gap-1.5">{category.emojis.map((emoji, emojiIndex) => <ElementButton key={`${emoji}-${emojiIndex}`} emoji={emoji} source={category.label} />)}</div></CardContent></Card></motion.div>)}
          </div> : filteredPacks.length ? <Card><CardContent className="flex flex-col items-center gap-2 p-8 text-center"><Layers3 className="h-8 w-8 text-primary" /><p className="font-semibold">Pasujący zestaw jest w paczkach powyżej</p><p className="text-sm text-muted-foreground">Możesz skopiować całą paczkę albo wybrać z niej pojedynczy element.</p></CardContent></Card>
            : <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center"><Search className="h-8 w-8 text-muted-foreground" /><p className="font-semibold">Nie znaleźliśmy takiego elementu</p><p className="text-sm text-muted-foreground">Spróbuj prostszego słowa albo wybierz wszystkie kategorie.</p><Button type="button" variant="outline" size="sm" onClick={() => { setSearch(''); setActiveCategory('all'); }}>Pokaż całą bibliotekę</Button></CardContent></Card>}
      </section>

      {!user && <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" />Kopiowanie działa bez konta. Po zalogowaniu możesz zapisywać ulubione.</p>}
    </motion.main>
  </AppLayout>;
}
