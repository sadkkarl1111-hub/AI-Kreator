import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Link2, Pause, Play, Search, Share2, X } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GIF_CATEGORIES, GIF_LIBRARY, filterGifs, type LibraryGif } from '@/lib/gifLibrary';
import { GifShareDialog } from '@/components/GifShareDialog';

export default function GifLibrary() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Wszystkie');
  const [playing, setPlaying] = useState(() => typeof window.matchMedia === 'function'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [notice, setNotice] = useState('');
  const [manualLink, setManualLink] = useState('');
  const [selected, setSelected] = useState<LibraryGif | null>(null);
  const gifs = useMemo(() => filterGifs(query, category), [query, category]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPlaying(!media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  async function copyLink(gif: LibraryGif) {
    const url = new URL(gif.src, window.location.origin).href;
    setNotice('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setNotice(`Link do „${gif.title}” skopiowany. To adres pliku; w WhatsApp użyj MP4.`);
    } catch {
      setManualLink(url);
    }
  }

  return <AppLayout>
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="space-y-5">
        <Link to="/tools" className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Wszystkie narzędzia
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl space-y-3">
            <span className="inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">Darmowe · bez logowania i kredytów</span>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Mały GIF. Dużo emocji.</h1>
            <p className="text-muted-foreground">Ruchome emoji i polskie reakcje. Do WhatsApp pobierz animację MP4. GIF-y zachowaj do aplikacji obsługujących ten format.</p>
          </div>
          <Button variant="outline" className="min-h-11 gap-2" onClick={() => setPlaying(value => !value)} aria-pressed={playing}>
            {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            {playing ? 'Zatrzymaj podglądy' : 'Odtwarzaj podglądy'}
          </Button>
        </div>
      </header>

      <aside className="rounded-xl border bg-card p-4 text-sm leading-6"><strong>Wysyłasz przez WhatsApp Web?</strong> Wybierz „Pobierz MP4”, a potem dodaj plik do czatu jako film. Kopiowanie linku wysyła adres, a kopiowanie obrazu może zatrzymać animację. MP4 to krótki film — odtwórz go w czacie.</aside>

      <section aria-label="Wyszukaj GIF" className="space-y-4">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={event => setQuery(event.target.value)} aria-label="Szukaj GIF-ów" placeholder="Szukaj emocji, np. dzięki, kawa, gratulacje…" className="h-12 bg-card pl-11 pr-12 text-base" />
          {query && <Button variant="ghost" size="icon" className="absolute right-1 top-1" onClick={() => setQuery('')} aria-label="Wyczyść wyszukiwanie"><X className="h-4 w-4" /></Button>}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Kategorie GIF-ów">
          {['Wszystkie', ...GIF_CATEGORIES].map(value => <Button key={value} variant={category === value ? 'default' : 'outline'} className="min-h-11 rounded-full px-4" aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</Button>)}
        </div>
        <div className="flex min-h-6 flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
          <p className="text-muted-foreground" role="status">GIF-y: {gifs.length} z {GIF_LIBRARY.length}</p>
          <p className="font-medium text-emerald-700 dark:text-emerald-300" role="status">{notice}</p>
        </div>
      </section>

      {gifs.length ? <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Galeria GIF-ów">
        {gifs.map((gif, index) => <article key={gif.id} className="overflow-hidden rounded-2xl border bg-card" aria-label={gif.title}>
          <img src={playing ? gif.src : gif.poster} alt={`Ilustrowana reakcja: ${gif.title}`} width={gif.width} height={gif.height} loading={index < 3 ? 'eager' : 'lazy'} decoding="async" className="aspect-[9/7] w-full bg-muted/30 object-contain" />
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{gif.title}</h2>
              <span className="shrink-0 text-xs text-muted-foreground">GIF · {Math.ceil(gif.bytes / 1024)} KB</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild className="min-h-11 gap-2 px-2"><a href={gif.mp4} download={`ai-kreator-${gif.id}.mp4`} aria-label={`Pobierz MP4: ${gif.title}`}><Download className="h-4 w-4" aria-hidden="true" /> Pobierz MP4</a></Button>
              <Button variant="outline" className="min-h-11 gap-2 px-2" onClick={() => setSelected(gif)} aria-label={`Wyślij animację: ${gif.title}`}><Share2 className="h-4 w-4" aria-hidden="true" /> Wyślij plik</Button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs"><a className="inline-flex min-h-9 items-center underline underline-offset-4" href={gif.src} download={`ai-kreator-${gif.id}.gif`} aria-label={`Pobierz GIF: ${gif.title}`}>Pobierz GIF{gif.category === 'Emoji' ? ' bez tła' : ''}</a><button className="inline-flex min-h-9 items-center gap-1 underline underline-offset-4" onClick={() => void copyLink(gif)} aria-label={`Kopiuj link: ${gif.title}`}><Link2 className="h-3 w-3" />Kopiuj tylko link</button></div>
          </div>
        </article>)}
      </section> : <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
        <h2 className="text-xl font-semibold">Nie ma jeszcze takiego GIF-a</h2>
        <p className="mt-2 text-muted-foreground">Spróbuj hasła „hej”, „serce” lub „brawo”, albo pokaż całą kolekcję.</p>
        <Button variant="outline" className="mt-5 min-h-11" onClick={() => { setQuery(''); setCategory('Wszystkie'); }}>Pokaż wszystkie GIF-y</Button>
      </div>}

      <section className="rounded-2xl border bg-card p-5 sm:p-7" aria-labelledby="gif-help">
        <h2 id="gif-help" className="text-xl font-semibold">Jak wysłać GIF w czacie?</h2>
        <div className="mt-4 grid gap-5 text-sm leading-6 sm:grid-cols-2">
          <div><h3 className="font-semibold">WhatsApp na komputerze</h3><p className="mt-1 text-muted-foreground">Pobierz MP4 i dodaj go do rozmowy przez „Zdjęcia i filmy” albo przeciągnij plik z folderu Pobrane. Odbiorca dostanie krótką animację jako film. Przycisk „Wyślij plik” pokazuje podgląd oraz menu udostępniania pliku, jeśli przeglądarka je obsługuje.</p></div>
          <div><h3 className="font-semibold">GIF-y i inne aplikacje</h3><p className="mt-1 text-muted-foreground">Pobierz GIF do aplikacji, która odtwarza ten format. Nowe emoji mają przezroczyste tło w GIF-ie; MP4 ma jasne tło. „Kopiuj tylko link” kopiuje adres pliku. Nie gwarantuje podglądu ani animacji w czacie.</p></div>
        </div>
        <p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">Autorska kolekcja AI Kreatora. GIF-y z tej galerii możesz bezpłatnie kopiować i wykorzystywać w projektach prywatnych i komercyjnych, bez podawania autora. <a href="/gifs/zasady.txt" className="underline underline-offset-4">Zasady korzystania</a>.</p>
      </section>
    </div>

    {selected && <GifShareDialog key={selected.id} gif={selected} onClose={() => setSelected(null)} />}

    <Dialog open={Boolean(manualLink)} onOpenChange={open => { if (!open) setManualLink(''); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Skopiuj link do GIF-a</DialogTitle><DialogDescription>Przeglądarka nie udostępniła schowka. Zaznacz poniższy link i skopiuj go ręcznie, a następnie wklej w czacie.</DialogDescription></DialogHeader>
        <Input aria-label="Link do GIF-a" value={manualLink} readOnly onFocus={event => event.target.select()} />
      </DialogContent>
    </Dialog>
  </AppLayout>;
}
