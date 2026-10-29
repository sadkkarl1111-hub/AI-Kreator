import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Shapes, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SvgColorInput, SvgExportActions } from '@/components/SvgControls';
import { svgDataUrl } from '@/lib/svgTools';
import { vpsFetch, vpsPublicFetch } from '@/lib/vpsApi';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';

type SvgResult = { svg: string; title: string; width: number; height: number; creditsUsed: number };
const examples = [
  'Uroczy lis siedzący na księżycu, gwiazdy wokół, pomarańczowy i granatowy, prosta ilustracja wektorowa',
  'Ikona koszyka sklepowego z sercem, zaokrąglone linie, kolor fioletowy, bez napisów',
  'Minimalistyczne logo kawiarni: filiżanka kawy z parą w kształcie listka, brąz i zieleń, bez napisów',
];
const formats = [{ name: 'Kwadrat', width: 1024, height: 1024 }, { name: 'Poziomo', width: 1200, height: 800 }, { name: 'Stories', width: 1080, height: 1920 }];

export default function SvgPromptGenerator() {
  const { user, loading: authLoading } = useAuth();
  const { balance, isAdmin, loading: creditsLoading, refetch: refreshCredits } = useCredits();
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('illustration');
  const [format, setFormat] = useState(formats[0]);
  const [transparent, setTransparent] = useState(true);
  const [background, setBackground] = useState('#ffffff');
  const [result, setResult] = useState<SvgResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [statusAttempt, setStatusAttempt] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const preview = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const statusController = new AbortController();
    vpsPublicFetch<{ available: boolean; creditCost: number }>('/public/svg-generator', { cache: 'no-store', signal: statusController.signal })
      .then(status => {
        if (statusController.signal.aborted) return;
        if (!Number.isSafeInteger(status.creditCost) || status.creditCost < 0) throw new Error('Brak cennika');
        setAvailable(status.available); setCost(status.creditCost);
      })
      .catch(() => { if (!statusController.signal.aborted) setStatusError(true); });
    return () => statusController.abort();
  }, [statusAttempt]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (result && window.innerWidth < 1024) preview.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [result]);

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (controller.current || !user || cost === null || available !== true || creditsLoading || prompt.trim().length < 5) return;
    const current = new AbortController();
    controller.current = current;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; current.abort(); }, 65000);
    setBusy(true); setError(''); setNotice('');
    try {
      const generated = await vpsFetch<SvgResult>('/ai/svg-generator', {
        method: 'POST', signal: current.signal,
        body: JSON.stringify({ prompt: prompt.trim(), style, width: format.width, height: format.height, transparent, background, expectedCreditCost: cost }),
      }, { retryAuthOnly: true });
      if (!current.signal.aborted) { setResult(generated); setNotice(`Grafika jest gotowa do pobrania. Pobrano ${generated.creditsUsed} kredytów.`); }
    } catch (reason) {
      if (timedOut) setError('AI nie odpowiedziało na czas. Spróbuj ponownie.');
      else if (!current.signal.aborted) setError(reason instanceof Error ? reason.message : 'Nie udało się wygenerować grafiki. Spróbuj ponownie.');
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === current) { controller.current = null; setBusy(false); }
      void refreshCredits();
    }
  };
  const cancel = () => { controller.current?.abort(); controller.current = null; setBusy(false); setNotice('Generowanie anulowane.'); };

  return <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
    <Card className="min-w-0"><CardContent className="p-4 sm:p-5"><form onSubmit={generate} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="svg-prompt" className="text-base font-semibold">Co chcesz stworzyć?</Label><Textarea id="svg-prompt" maxLength={2000} minLength={5} required disabled={busy} value={prompt} onChange={event => setPrompt(event.target.value)} rows={6} className="resize-y" placeholder="Np. kot astronauta na rakiecie, fiolet i pomarańcz, płaski styl wektorowy, bez napisów" /><p className="text-xs text-muted-foreground">Opisz obiekt, kolory, styl i ewentualny napis. {prompt.length}/2000</p></div>
      <div className="space-y-2"><p className="text-sm font-medium">Wypróbuj opis</p>{examples.map((example, index) => <button key={example} type="button" disabled={busy} onClick={() => { setPrompt(example); setStyle(index === 1 ? 'icon' : index === 2 ? 'logo' : 'illustration'); }} className="block min-h-11 w-full rounded-lg border px-3 py-2 text-left text-xs leading-relaxed hover:border-primary disabled:opacity-50">{example}</button>)}</div>
      <div className="space-y-2"><Label htmlFor="svg-ai-style">Rodzaj grafiki</Label><select id="svg-ai-style" value={style} disabled={busy} onChange={event => setStyle(event.target.value)} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="illustration">Ilustracja</option><option value="icon">Ikona</option><option value="logo">Proste logo</option><option value="pattern">Wzór / tło</option></select></div>
      <div className="space-y-2"><p className="text-sm font-medium">Format</p><div className="flex flex-wrap gap-2">{formats.map(item => <Button key={item.name} type="button" disabled={busy} className="h-11" variant={format.name === item.name ? 'default' : 'outline'} onClick={() => setFormat(item)}>{item.name}</Button>)}</div></div>
      <div className="space-y-2"><label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><Checkbox disabled={busy} checked={transparent} onCheckedChange={checked => setTransparent(checked === true)} />Przezroczyste tło</label>{!transparent && <SvgColorInput id="svg-ai-background" label="Kolor tła" value={background} onChange={setBackground} />}</div>
      {available === false && <p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">Generator AI jest obecnie niedostępny. Skorzystaj z darmowych szablonów lub biblioteki SVG.</p>}
      {statusError && <div role="alert" className="text-sm text-destructive">Nie udało się sprawdzić dostępności AI. <Button type="button" variant="link" onClick={() => { setStatusError(false); setStatusAttempt(value => value + 1); }}>Spróbuj ponownie</Button></div>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      <div className="rounded-lg border p-3 text-sm space-y-1"><p className="font-medium">{cost === null ? 'Sprawdzam cenę…' : `Koszt generowania: ${cost} kredytów`}</p>{user && <p className="text-muted-foreground">{isAdmin ? 'Konto administratora — bez potrącania kredytów.' : `Twoje saldo: ${balance ?? '…'} kredytów`}</p>}<p className="text-xs text-muted-foreground">Kredyty rozliczamy za udaną generację. Błąd AI lub anulowanie trwającej generacji powoduje zwrot.</p></div>
      {!authLoading && !user ? <Button asChild className="h-12 w-full"><Link to="/auth?returnTo=%2Ftools%2Fsvg-generator">Zaloguj się, aby generować</Link></Button> : <Button type="submit" className="h-12 w-full gap-2" disabled={busy || authLoading || creditsLoading || available !== true || cost === null || (!isAdmin && (balance ?? 0) < cost) || prompt.trim().length < 5}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy ? 'Tworzę grafikę…' : `Generuj SVG${cost === null ? '' : ` · ${isAdmin ? 0 : cost} kredytów`}`}</Button>}
      {user && !creditsLoading && !isAdmin && cost !== null && (balance ?? 0) < cost && <p className="text-sm text-destructive">Za mało kredytów. <Link to="/credits" className="underline">Doładuj konto</Link></p>}
      {busy && <Button type="button" variant="outline" className="h-11 w-full" onClick={cancel}>Anuluj generowanie</Button>}
      <p className="text-xs leading-relaxed text-muted-foreground">Do 10 prób generowania na 24 godziny. AI najlepiej sprawdza się w ikonach i prostych ilustracjach. Opis jest przesyłany do Google Gemini. Gotowe szablony i biblioteka SVG są darmowe.</p>
    </form></CardContent></Card>
    <section ref={preview} className="min-w-0 scroll-mt-20 space-y-4 lg:sticky lg:top-20" aria-label="Podgląd grafiki AI">
      <Card><CardContent className="p-3 sm:p-5"><div aria-busy={busy} className="relative flex min-h-80 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
        {result ? <img src={svgDataUrl(result.svg)} alt={result.title} className={`max-h-[580px] w-full object-contain ${busy ? 'opacity-40' : ''}`} /> : <div className="space-y-3 bg-background/90 p-6 text-center text-muted-foreground"><Shapes className="mx-auto h-12 w-12 text-primary/50" /><p>{busy ? 'AI rysuje Twoją grafikę…' : 'Tutaj pojawi się grafika z Twojego opisu'}</p></div>}
        {busy && result && <div className="absolute inset-0 flex items-center justify-center bg-background/50 text-sm"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Tworzę nową grafikę…</div>}
      </div>{result && <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{result.title}</span><span>{result.width} × {result.height} px · SVG</span></div>}</CardContent></Card>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{busy ? 'Generowanie może potrwać około minuty.' : notice}</p>
      {result && <SvgExportActions svg={result.svg} name="grafika-ai" />}
      <Button asChild variant="link" className="h-11"><Link to="/tools/svg-library">Zobacz bibliotekę SVG</Link></Button>
    </section>
  </div>;
}
