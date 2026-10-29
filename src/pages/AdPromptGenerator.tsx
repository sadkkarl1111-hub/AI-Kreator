import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Check, ChevronDown, Copy, ExternalLink, ImagePlus, Loader2, Megaphone, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { vpsFetch } from '@/lib/vpsApi';
import { openAdGenerator } from '@/lib/adGeneratorHandoff';
import { useAdWeeklyAccess } from '@/hooks/useAdWeeklyAccess';
import { adQuotaDate } from '@/lib/adQuota';
import { cn } from '@/lib/utils';
import { AdCompetitorResearch } from '@/components/AdCompetitorResearch';
import { AdStudioImageGenerator } from '@/components/AdStudioImageGenerator';
import { AD_CAMPAIGN_GOALS, type AdCampaignGoal, type AdResearchExample } from '@/lib/adStudio';

type UploadedImage = { id: string; name: string; mediaType: string; data: string; preview: string };
export type AdPromptResult = {
  title: string; hookPl: string; emphasisPl?: string; prompt: string; needsImage: boolean; imageNote: string;
  category?: string; visualStyle?: string; styleId?: string; sceneConcept?: string;
  colors?: string[]; subheadPl?: string; benefitsPl?: string[]; ctaPl?: string; badgePl?: string;
  hookMechanism?: string; whyItWorks?: string; sourceBasis?: string[];
};
type Analysis = {
  offer: string; audience: string; campaignGoal: string; mechanisms: string[];
  concreteBenefits: string[]; missingInformation: string[];
};
type GenerateResponse = { ok: boolean; prompts: AdPromptResult[]; analysis?: Analysis; partial?: boolean; model?: { id: string; label: string } };
const FILTERS = [
  ['all', 'Wszystkie'], ['performance', 'Sprzedażowe'], ['scenic', 'Sceniczne'], ['creative', 'Kreatywne'],
  ['modern', 'Nowoczesne'], ['educational', 'Edukacyjne'], ['premium', 'Premium'],
];
const TOTAL_IMAGE_LIMIT = 14 * 1024 * 1024;
const EXAMPLES = [
  ['Usługi', 'Automatyzuję faktury i obsługę zapytań dla małych firm. Dane z formularza trafiają do CRM i klient otrzymuje odpowiedź e-mail. Chcę zachęcić do rozmowy o wdrożeniu.'],
  ['Webinar', 'Bezpłatny webinar dla początkujących: jak zbudować plan regularnego inwestowania w ETF-y. Wyjaśniamy wybór ETF-ów, koszty i ryzyko. Cel reklamy: zapis na webinar.'],
  ['Produkt', 'Ręcznie robione świece sojowe w szkle wielokrotnego użytku. Zapachy inspirowane lasem. Chcę zachęcić do obejrzenia kolekcji w sklepie.'],
];

function fileToPayload(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nie udało się odczytać zdjęcia.'));
    reader.onload = () => {
      const preview = String(reader.result || '');
      resolve({ id: crypto.randomUUID(), name: file.name, mediaType: file.type, preview, data: preview.slice(preview.indexOf(',') + 1) });
    };
    reader.readAsDataURL(file);
  });
}

function ConceptCard({ ad, index, onUse, imageGenerator }: { ad: AdPromptResult; index: number; onUse: (ad: AdPromptResult) => void; imageGenerator?: ReactNode }) {
  const light = ['editorial', 'collage', 'demo'].includes(ad.styleId || '');
  const colors = (ad.colors || []).filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 5);
  const accent = colors[2] || '#a855f7';
  const emphasisIndex = ad.emphasisPl ? ad.hookPl.toLocaleLowerCase('pl').indexOf(ad.emphasisPl.toLocaleLowerCase('pl')) : -1;
  const headline = emphasisIndex >= 0 && ad.emphasisPl ? <>
    {ad.hookPl.slice(0, emphasisIndex)}
    <span className="decoration-[0.13em] underline-offset-[0.14em]" style={{ textDecorationLine: 'underline', textDecorationColor: accent }}>{ad.hookPl.slice(emphasisIndex, emphasisIndex + ad.emphasisPl.length)}</span>
    {ad.hookPl.slice(emphasisIndex + ad.emphasisPl.length)}
  </> : ad.hookPl;
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <span className="text-sm font-semibold">{String(index + 1).padStart(2, '0')} · {ad.visualStyle || ad.title}</span>
        <div className="flex shrink-0 -space-x-1" aria-label="Paleta kolorów">
          {colors.map((color, i) => <span key={i} title={color} className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: color }} />)}
        </div>
      </div>
      <div className={cn('relative flex flex-1 flex-col gap-4 overflow-hidden p-6 sm:p-7', light ? 'bg-stone-50 text-slate-950' : 'bg-slate-950 text-white')}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: accent }} />
        <p className={cn('relative text-[11px] font-medium uppercase tracking-[0.18em]', light ? 'text-slate-500' : 'text-slate-400')}>Podgląd tekstu · {ad.hookMechanism || 'pomysł na kampanię'}</p>
        {ad.badgePl && <span className="relative w-fit rounded-full border border-current/20 px-3 py-1 text-xs font-medium">{ad.badgePl}</span>}
        <h3 className="relative break-words text-3xl font-black leading-[1.15] tracking-tight sm:text-4xl">{headline}</h3>
        {ad.subheadPl && <p className="relative text-base leading-relaxed opacity-85">{ad.subheadPl}</p>}
        {!!ad.benefitsPl?.length && <ul className="relative space-y-2">
          {ad.benefitsPl.map((benefit, i) => <li key={i} className="flex items-start gap-2 text-sm leading-relaxed"><Check className="mt-0.5 h-4 w-4 shrink-0" />{benefit}</li>)}
        </ul>}
        {ad.ctaPl && <div className="relative mt-auto pt-3">
          <span className={cn('inline-flex max-w-full items-center gap-3 rounded-xl px-5 py-3 text-sm font-bold shadow-lg', light ? 'bg-slate-950 text-white' : 'bg-white text-slate-950')}>
            {ad.ctaPl}<ArrowRight className="h-4 w-4 shrink-0" />
          </span>
        </div>}
      </div>
      <div className="space-y-4 p-5">
        <div className={cn('rounded-xl border px-3.5 py-3', ad.needsImage ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950')}>
          <p className="flex items-center gap-2 text-sm font-bold">
            {ad.needsImage ? <ImagePlus className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
            Załącz zdjęcie: {ad.needsImage ? 'TAK' : 'NIE'}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed opacity-80">
            {ad.imageNote || (ad.needsImage ? 'Dodaj w generatorze zdjęcie osoby albo produktu, który ma zostać zachowany.' : 'AI może stworzyć postać, produkt i całą scenę od podstaw.')}
          </p>
        </div>
        <Button className="w-full gap-2 gradient-bg" onClick={() => onUse(ad)}><ExternalLink className="h-4 w-4" />Użyj tej reklamy</Button>
        {imageGenerator}
        <details className="group rounded-xl border">
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium">Szczegóły i pełny prompt<ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
          <div className="space-y-3 border-t p-3">
            {ad.whyItWorks && <p className="text-sm leading-relaxed">{ad.whyItWorks}</p>}
            {!!ad.sourceBasis?.length && <p className="text-xs leading-relaxed text-muted-foreground">Na podstawie materiałów: {ad.sourceBasis.join(' · ')}</p>}
            <Textarea aria-label={'Prompt: ' + ad.title} readOnly value={ad.prompt} className="min-h-52 font-mono text-xs leading-relaxed" />
            <Button variant="outline" size="sm" className="gap-2" onClick={async () => {
              try { await navigator.clipboard.writeText(ad.prompt); toast.success('Prompt skopiowany.'); }
              catch { toast.error('Nie udało się skopiować. Zaznacz tekst w polu promptu.'); }
            }}><Copy className="h-4 w-4" />Kopiuj prompt</Button>
          </div>
        </details>
      </div>
    </Card>
  );
}

export default function AdPromptGenerator() {
  const access = useAdWeeklyAccess();
  const restoredOwner = useRef<string | undefined>(undefined);
  const [text, setText] = useState('');
  const [goal,setGoal]=useState<AdCampaignGoal>('auto');
  const [competitorExamples,setCompetitorExamples]=useState<AdResearchExample[]>([]);
  const [imageJobs,setImageJobs]=useState(0);
  const onImageBusy=useCallback((active:boolean)=>setImageJobs(previous=>Math.max(0,previous+(active?1:-1))),[]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [readingImages, setReadingImages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [campaignVersion,setCampaignVersion]=useState(0);
  const [activeFilter, setActiveFilter] = useState('all');
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [showBrief, setShowBrief] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const readingRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (!access.data || restoredOwner.current === access.userId) return;
    queueMicrotask(() => {
      if (!active) return;
      restoredOwner.current = access.userId;
      controllerRef.current?.abort();
      setResult(null); setImages([]); setText(''); setError('');
      const last = access.data?.lastSession;
      if (last?.prompts?.length) {
        setText(last.inputText || ''); setResult({ ok: true, prompts: last.prompts }); setShowBrief(false);
      }
    });
    return () => { active = false; };
  }, [access.data, access.userId]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (result) resultsRef.current?.scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, [result]);

  const addFiles = async (files: FileList | File[]) => {
    if (readingRef.current || controllerRef.current || imageJobs) return;
    const accepted = Array.from(files).filter(f => ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(f.type));
    if (!accepted.length) { setError('Wybierz zdjęcia JPG, PNG, WebP lub HEIC.'); return; }
    if (accepted.length + images.length > 6) { setError('Możesz dodać maksymalnie 6 zdjęć.'); return; }
    if (accepted.some(f => f.size > 5 * 1024 * 1024)) { setError('Jedno ze zdjęć przekracza 5 MB. Wybierz mniejszy plik.'); return; }
    readingRef.current = true;
    setReadingImages(true);
    try {
      const added = await Promise.all(accepted.map(fileToPayload));
      if ([...images, ...added].reduce((sum, image) => sum + image.data.length, 0) > TOTAL_IMAGE_LIMIT) throw new Error('Łączny rozmiar zdjęć jest za duży. Zmniejsz pliki lub wybierz ich mniej.');
      setImages(current => [...current, ...added]);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Nie udało się dodać zdjęć.'); }
    finally { readingRef.current = false; setReadingImages(false); }
  };

  const generate = async () => {
    if (!access.data?.campaign.remaining || controllerRef.current || readingRef.current || imageJobs || (!text.trim() && !images.length)) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const data = await vpsFetch<GenerateResponse>('/ad-generator/generate', {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ text: text.trim(), images: images.map(({ data, mediaType }) => ({ data, mediaType })), goal, competitorExamples }),
      }, { retryAuthOnly: true });
      if (!data.ok || !Array.isArray(data.prompts) || !data.prompts.length) throw new Error('Nie otrzymaliśmy propozycji. Spróbuj ponownie.');
      if (controller.signal.aborted) return;
      setResult(data);
      setCampaignVersion(previous=>previous+1);
      setShowBrief(false);
      setActiveFilter('all');
      toast.success('Gotowe — wybierz pomysł na reklamę.');
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Nie udało się przygotować reklam. Spróbuj ponownie.');
    } finally {
      if (controllerRef.current === controller) { controllerRef.current = null; setLoading(false); void access.refresh(); }
    }
  };

  const onUse = (ad: AdPromptResult) => {
    try {
      openAdGenerator(ad.prompt, ad.styleId === 'collage' ? 'illustration' : 'realistic');
      toast.success('Generator otwarty w nowej karcie. Propozycje pozostają tutaj.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Nie udało się otworzyć generatora.'); }
  };

  if (access.loading) return <AppLayout><div className="flex justify-center p-16" role="status"><Loader2 className="h-6 w-6 animate-spin"/><span className="sr-only">Sprawdzam limit</span></div></AppLayout>;
  if (!access.data) return <AppLayout><Card className="mx-auto my-10 max-w-xl space-y-4 p-6"><h1 className="text-2xl font-bold">Generator reklam</h1><p role="alert">{access.error || 'Nie udało się sprawdzić limitu.'}</p><Button onClick={() => void access.refresh()}>Odśwież dostęp</Button></Card></AppLayout>;

  const prompts = result?.prompts || [];


  return <AppLayout>
    <div className="container mx-auto max-w-6xl px-4 py-5 sm:py-10">
      <header className="mb-5 flex flex-col justify-between gap-4 sm:mb-7 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><Megaphone className="h-4 w-4" />Twoje studio reklam</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Z oferty do <span className="gradient-text">mocnej reklamy.</span></h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Dodaj opis lub zdjęcia. Otrzymasz różne pomysły z gotowym nagłówkiem, korzyściami, CTA i dopracowaną sceną.</p>
        </div>
        <Badge variant="outline" className="hidden w-fit shrink-0 gap-2 px-3 py-2 sm:inline-flex"><Sparkles className="h-4 w-4" />Style dobiera AI</Badge>
      </header>

      <div className="mb-5 space-y-2 rounded-xl border bg-card p-4 text-sm" aria-label="Limit darmowych promptów">
        <p className="font-semibold">Darmowe prompty: 1 zestaw co 7 dni na adres IP i konto · 0 kredytów</p>
        <p className="text-muted-foreground">Limit jest zużywany przy rozpoczęciu generowania. Grafiki z wybranego promptu są rozliczane osobno kredytami.</p>
        <p role="status">{access.data.campaign.remaining ? 'Możesz teraz przygotować bezpłatny zestaw.' : `Limit wykorzystany. Następne generowanie: ${adQuotaDate(access.data.campaign)}.`}</p>
        {!access.data.campaign.remaining && result && <p className="text-muted-foreground">Twój zapisany zestaw pozostaje dostępny poniżej — możesz nadal używać promptów i generować z nich grafiki.</p>}
      </div>
      <Card className="overflow-hidden">
        {result && <button type="button" onClick={() => setShowBrief(!showBrief)} aria-expanded={showBrief} className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left">
          <span><span className="block font-semibold">Twój opis i materiały</span><span className="text-sm text-muted-foreground">{images.length} zdjęć · {text.length} znaków</span></span>
          <span className="flex items-center gap-2 text-sm font-medium">{showBrief ? 'Zwiń' : 'Zmień opis'}<ChevronDown className={cn('h-4 w-4', showBrief && 'rotate-180')} /></span>
        </button>}
        <form hidden={Boolean(result)&&!showBrief} onSubmit={event => { event.preventDefault(); void generate(); }} className={cn('p-5 sm:p-7', result && 'border-t')}>
          <fieldset disabled={loading || readingImages || imageJobs > 0} className="min-w-0">
            <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
              <div>
                <label htmlFor="ad-description" className="mb-2 block font-semibold">Co reklamujemy?</label>
                <Textarea id="ad-description" value={text} maxLength={12000} onChange={e => setText(e.target.value)} className="min-h-32 resize-y text-base leading-relaxed sm:min-h-44" placeholder="Co oferujesz, komu i dlaczego warto? Napisz własnymi słowami. Możesz też dodać same zdjęcia." />
                <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground"><span>Pomogą konkrety: oferta, korzyści i cel kliknięcia.</span><span className="shrink-0">{text.length}/12000</span></div>
                <details className="mt-3">
                  <summary className="w-fit cursor-pointer text-xs text-muted-foreground">Potrzebujesz przykładu?</summary>
                  <div className="mt-2 flex flex-wrap gap-2">{EXAMPLES.map(([label, example]) => <Button key={label} type="button" variant="outline" size="sm" onClick={() => setText(example)}>{label}</Button>)}</div>
                </details>
              </div>
              <div>
                <p className="mb-2 font-semibold">lub dodaj materiały</p>
                <div onDragOver={e => { e.preventDefault(); if (!loading) setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={e => { e.preventDefault(); setDragActive(false); void addFiles(e.dataTransfer.files); }}
                  className={cn('flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center transition sm:min-h-44 sm:p-5', dragActive ? 'border-primary bg-primary/10' : 'bg-muted/30')}>
                  <ImagePlus className="mb-2 h-7 w-7 text-primary" />
                  <p className="text-sm font-medium">Własne zdjęcia i screeny Twojej oferty</p>
                  <p className="mt-1 text-xs text-muted-foreground">Przeciągnij tutaj · do 6 plików po 5 MB</p>
                  <input ref={fileInputRef} aria-label="Dodaj zdjęcia" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr-only" onChange={e => { if (e.target.files) void addFiles(e.target.files); e.target.value = ''; }} />
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => fileInputRef.current?.click()}>{readingImages ? 'Wczytuję…' : 'Wybierz zdjęcia'}</Button>
                </div>
                {!!images.length && <div className="mt-3 grid grid-cols-3 gap-2">
                  {images.map(image => <div key={image.id} className="relative overflow-hidden rounded-lg border bg-muted">
                    <img src={image.preview} alt={image.name} className="h-20 w-full object-contain" />
                    <button type="button" aria-label={'Usuń ' + image.name} className="absolute right-1 top-1 rounded-full bg-background p-1 shadow" onClick={() => setImages(current => current.filter(item => item.id !== image.id))}><X className="h-3 w-3" /></button>
                  </div>)}
                </div>}
              </div>
            </div>
            <label className="mt-5 block space-y-2 text-sm font-semibold">Cel kampanii<select aria-label="Cel kampanii" value={goal} onChange={event=>setGoal(event.target.value as AdCampaignGoal)} className="h-11 w-full rounded-md border bg-background px-3 font-normal">{AD_CAMPAIGN_GOALS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <AdCompetitorResearch description={text} goal={goal} value={competitorExamples} onChange={setCompetitorExamples} disabled={loading||readingImages||imageJobs>0} quota={access.data.research} onQuotaRefresh={access.refresh}/>
            <div className="mt-6 flex flex-col justify-between gap-3 border-t pt-5 sm:flex-row sm:items-center">
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">Jeden klik, 12 kierunków — od mocnego plakatu po dżunglę, basen i góry. Bez wybierania stylu na starcie.</p>
              <Button type="submit" size="lg" className="h-auto min-h-11 w-full min-w-0 shrink-0 gap-2 whitespace-normal px-3 gradient-bg sm:w-auto" disabled={!access.data.campaign.remaining || (!text.trim() && !images.length) || loading || readingImages || imageJobs > 0}><Sparkles className="h-4 w-4 shrink-0" />{result ? 'Przygotuj nowe propozycje' : 'Przygotuj reklamy'}<ArrowRight className="hidden h-4 w-4 shrink-0 sm:block" /></Button>
            </div>
          </fieldset>
        </form>
        {loading && <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 border-t bg-primary/5 px-6 py-5">
          <div className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-primary" /><div><p className="font-semibold">Przygotowujemy Twoje reklamy</p><p className="text-sm text-muted-foreground">Analiza materiałów, hooki i różne sceny. To może potrwać do kilku minut.</p></div></div>
          <Button variant="ghost" size="sm" onClick={() => { controllerRef.current?.abort(); }}>Anuluj</Button>
        </div>}
        {error && <div role="alert" className="border-t bg-destructive/5 px-6 py-4 text-sm leading-relaxed text-destructive">{error}</div>}
      </Card>

      {result && <section ref={resultsRef} className="mt-9 scroll-mt-24 space-y-5" aria-label="Propozycje reklam">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div><p className="mb-1 text-sm text-primary">Wybierz kierunek</p><h2 className="text-2xl font-bold">{prompts.length} pomysłów na Twoją reklamę</h2>{result.model?.label && <p className="mt-2 text-xs text-muted-foreground">Prompty przygotował: {result.model.label}</p>}</div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">Karty to podgląd tekstu, nie gotowe grafiki. Wybierz „Wygeneruj grafikę tutaj”, aby porównać kompozycje A/B/C bez opuszczania Studia, lub „Użyj tej reklamy”, aby przejść do pełnego generatora.</p>
        </div>
        {result.partial && <p role="status" className="rounded-xl border bg-muted/40 p-3 text-sm">Część propozycji nie przeszła sprawdzenia. Pokazujemy {prompts.length} gotowych pomysłów; możesz też przygotować nowy zestaw.</p>}
        {result.analysis && <details className="group rounded-xl border bg-card">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3"><span className="min-w-0"><span className="text-sm font-semibold">Jak AI zrozumiało ofertę</span><span className="mt-1 block truncate text-xs text-muted-foreground">{result.analysis.offer || 'Rozwiń analizę materiałów'}</span></span><ChevronDown className="h-4 w-4 shrink-0 group-open:rotate-180" /></summary>
          <div className="grid gap-4 border-t p-4 text-sm leading-relaxed sm:grid-cols-2">
            <div><p className="font-semibold">Oferta i odbiorca</p><p>{result.analysis.offer}</p><p className="text-muted-foreground">{result.analysis.audience}</p></div>
            <div><p className="font-semibold">Cel kliknięcia</p><p>{result.analysis.campaignGoal}</p></div>
            <div><p className="font-semibold">Konkretne korzyści</p><ul className="mt-1 space-y-1">{(result.analysis.concreteBenefits || []).map((item, i) => <li key={i}>✓ {item}</li>)}</ul></div>
            {!!result.analysis.missingInformation?.length && <div><p className="font-semibold">Co możesz doprecyzować</p><p className="text-muted-foreground">{result.analysis.missingInformation.join(' ')}</p><Button variant="link" className="h-auto px-0 py-1" onClick={() => { setShowBrief(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Uzupełnij opis</Button></div>}
          </div>
        </details>}
        <div role="group" aria-label="Filtruj propozycje" className="flex flex-wrap gap-2">
          {FILTERS.filter(([id]) => id === 'all' || prompts.some(ad => ad.category === id)).map(([id, label]) => <Button key={id} size="sm" variant={id === activeFilter ? 'default' : 'outline'} aria-pressed={id === activeFilter} onClick={() => setActiveFilter(id)}>{label}<span className="ml-2 opacity-65">{id === 'all' ? prompts.length : prompts.filter(ad => ad.category === id).length}</span></Button>)}
        </div>
        <div key={campaignVersion} className="grid items-stretch gap-5 lg:grid-cols-2">{prompts.map((ad,index)=><div key={ad.styleId || index} hidden={activeFilter!=='all'&&ad.category!==activeFilter}><ConceptCard ad={ad} index={index} onUse={onUse} imageGenerator={<AdStudioImageGenerator ad={ad} index={index} disabled={loading} onBusyChange={onImageBusy}/>}/></div>)}</div>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">Wybierz różne pomysły do porównania w kampanii. Wyniki pokażą, który komunikat trafia do Twoich odbiorców.</p>
      </section>}
      {!result && <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ArrowDown className="h-3 w-3" />Tutaj pojawią się Twoje propozycje.</p>}
    </div>
  </AppLayout>;
}
