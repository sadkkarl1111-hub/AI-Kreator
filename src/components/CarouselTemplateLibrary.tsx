import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CAROUSEL_TEMPLATES } from '@/lib/carouselTemplates';
import { CarouselTemplatePreview } from './CarouselTemplatePreview';

const normalize = (value: string) => value.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
export function CarouselTemplateLibrary({ selected, onSelect, onApply }: { selected: string; onSelect: (id: string) => void; onApply: (sample: boolean) => void }) {
  const [collection, setCollection] = useState('creator');
  const [search, setSearch] = useState('');
  const [sample, setSample] = useState(true);
  const chosen = CAROUSEL_TEMPLATES.find(item => item.id === selected)!;
  const visible = CAROUSEL_TEMPLATES.filter(item => (collection === 'all' || (collection === 'creator' ? item.collection === 'creator' : item.collection !== 'creator')) && normalize(`${item.name} ${item.description}`).includes(normalize(search.trim())));
  return <div className="space-y-4">
    <div className="sticky top-0 z-10 space-y-2 rounded-xl border bg-card p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">Wybrano: <strong className="text-foreground">{chosen.name}</strong></p>
      <Button className="h-11 w-full gap-2" onClick={() => onApply(sample)}><Sparkles className="h-4 w-4"/>Zastosuj szablon</Button>
      {chosen.sampleImage && <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={sample} onChange={event => setSample(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary"/><span>Dodaj przykładową postać AI. Własne zdjęcie wstawisz w „Grafiki”.</span></label>}
      <p className="text-[11px] text-muted-foreground">Zastępuje slajdy, zachowuje Twoją markę i logo. Zmianę cofniesz przyciskiem „Cofnij”.</p>
    </div>
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{CAROUSEL_TEMPLATES.length} zestawy szablonów</h3><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">12 nowych</span></div>
      <div role="group" aria-label="Kolekcja szablonów" className="grid grid-cols-3 gap-1">{[{ id: 'creator', label: 'Twórca / IG' }, { id: 'classic', label: 'Klasyczne' }, { id: 'all', label: 'Wszystkie' }].map(item => <Button key={item.id} size="sm" variant={collection === item.id ? 'default' : 'outline'} aria-pressed={collection === item.id} className="px-1 text-xs" onClick={() => setCollection(item.id)}>{item.label}</Button>)}</div>
      <label className="relative block"><span className="sr-only">Szukaj szablonu</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Np. webinar, błędy, oferta…" className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"/></label>
      <p aria-live="polite" className="text-xs text-muted-foreground">Znaleziono: {visible.length}</p>
    </div>
    <details className="rounded-xl border p-3"><summary className="cursor-pointer text-xs font-semibold">Podejrzyj zestaw: {chosen.name}</summary><div className="mt-3 grid grid-cols-3 gap-2">{[0, 1, chosen.slides.length - 1].map((index, number) => <div key={number}><CarouselTemplatePreview id={selected} slideIndex={index} sample={sample} compact/><p className="mt-1 text-center text-[10px] text-muted-foreground">{number === 0 ? 'Okładka' : number === 1 ? 'Środek' : 'Finał'}</p></div>)}</div><p className="mt-2 text-xs text-muted-foreground">{chosen.description}</p></details>
    <div className="grid grid-cols-2 gap-2 p-1">{visible.map(item => <button key={item.id} type="button" aria-label={`Wybierz szablon: ${item.name}`} aria-pressed={selected === item.id} onClick={() => onSelect(item.id)} className={`min-w-0 rounded-xl border p-2 text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${selected === item.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-card'}`}>
      <CarouselTemplatePreview id={item.id}/><span className="mt-2 block text-xs font-semibold">{item.name}</span><span className="mt-1 block text-[10px] text-muted-foreground">{item.slides.length} slajdów{item.sampleImage ? ' · postać AI' : ''}</span>
    </button>)}</div>
    {!visible.length && <p className="rounded-xl border p-4 text-sm text-muted-foreground">Brak pasujących szablonów. Zmień wyszukiwanie lub wybierz „Wszystkie”.</p>}
  </div>;
}
