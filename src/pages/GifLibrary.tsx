import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Link2, Pause, Play, Search, X } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GIF_CATEGORIES, GIF_LIBRARY, filterGifs, type LibraryGif } from '@/lib/gifLibrary';

export default function GifLibrary() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Wszystkie');
  const [playing, setPlaying] = useState(() => typeof window.matchMedia === 'function'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [notice, setNotice] = useState('');
  const [manualLink, setManualLink] = useState('');
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
      setNotice(`Link do „${gif.title}” skopiowany. Wklej go w czacie.`);
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
            <p className="text-muted-foreground">Gotowe animacje z polskimi napisami. Wybierz reakcję, skopiuj link albo pobierz GIF i wyślij go w rozmowie.</p>
          </div>
          <Button variant="outline" className="min-h-11 gap-2" onClick={() => setPlaying(value => !value)} aria-pressed={playing}>
            {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            {playing ? 'Zatrzymaj podglądy' : 'Odtwarzaj podglądy'}
          </Button>
        </div>
      </header>

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
          <img src={playing ? gif.src : gif.poster} alt={`Ilustrowana reakcja: ${gif.title}`} width={gif.width} height={gif.height} loading={index < 3 ? 'eager' : 'lazy'} decoding="async" className="aspect-[9/7] w-full object-cover" />
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{gif.title}</h2>
              <span className="shrink-0 text-xs text-muted-foreground">GIF · {Math.ceil(gif.bytes / 1024)} KB</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="min-h-11 gap-2 px-2" onClick={() => void copyLink(gif)} aria-label={`Kopiuj link: ${gif.title}`}><Link2 className="h-4 w-4" aria-hidden="true" /> Kopiuj link</Button>
              <Button asChild className="min-h-11 gap-2 px-2"><a href={gif.src} download={`ai-kreator-${gif.id}.gif`} aria-label={`Pobierz GIF: ${gif.title}`}><Download className="h-4 w-4" aria-hidden="true" /> Pobierz GIF</a></Button>
            </div>
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
          <div><h3 className="font-semibold">Wklej link</h3><p className="mt-1 text-muted-foreground">Kliknij „Kopiuj link” i wklej go w rozmowie. Jeśli komunikator obsługuje podgląd GIF-ów z linków, wyświetli animację. W pozostałych przypadkach odbiorca zobaczy link.</p></div>
          <div><h3 className="font-semibold">Wyślij plik</h3><p className="mt-1 text-muted-foreground">Kliknij „Pobierz GIF”, a potem dodaj pobrany plik jako załącznik w czacie, poście lub prezentacji. Zachowanie animacji zależy od aplikacji. Zatrzymanie podglądu tutaj nie zmienia pobieranego GIF-a.</p></div>
        </div>
        <p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">Autorska kolekcja AI Kreatora. GIF-y z tej galerii możesz bezpłatnie kopiować i wykorzystywać w projektach prywatnych i komercyjnych, bez podawania autora. <a href="/gifs/zasady.txt" className="underline underline-offset-4">Zasady korzystania</a>.</p>
      </section>
    </div>

    <Dialog open={Boolean(manualLink)} onOpenChange={open => { if (!open) setManualLink(''); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Skopiuj link do GIF-a</DialogTitle><DialogDescription>Przeglądarka nie udostępniła schowka. Zaznacz poniższy link i skopiuj go ręcznie, a następnie wklej w czacie.</DialogDescription></DialogHeader>
        <Input aria-label="Link do GIF-a" value={manualLink} readOnly onFocus={event => event.target.select()} />
      </DialogContent>
    </Dialog>
  </AppLayout>;
}
