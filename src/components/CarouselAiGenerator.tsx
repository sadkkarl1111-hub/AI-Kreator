import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getStoredAuthSession } from '@/lib/authSession';
import { vpsFetch } from '@/lib/vpsApi';
import type { useCarouselGeneratorAccess } from '@/hooks/useCarouselGeneratorAccess';
import type { CarouselImageTarget, CarouselLibraryImage } from '@/lib/carouselLibrary';

type Props = {
  access: ReturnType<typeof useCarouselGeneratorAccess>;
  disabled: boolean;
  canAddImage: boolean;
  format: 'square' | 'portrait';
  slideNumber: number;
  onBusyChange: (busy: boolean) => void;
  onInsert: (item: CarouselLibraryImage, target: CarouselImageTarget, signal: AbortSignal) => Promise<void>;
};

export function CarouselAiGenerator({ access, disabled, canAddImage, format, slideNumber, onBusyChange, onInsert }: Props) {
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState('');
  const [style, setStyle] = useState('illustration');
  const [target, setTarget] = useState<CarouselImageTarget>('element');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ owner: string; image: CarouselLibraryImage } | null>(null);
  const job = useRef<AbortController | null>(null);
  useEffect(() => () => { job.current?.abort(); job.current = null; onBusyChange(false); }, [access.userId, onBusyChange]);
  const data = access.data;
  const model = data?.models.find(item => item.id === modelId) || data?.models[0];
  const retained = result && result.owner === access.userId ? result.image : null;
  const insufficient = Boolean(data && !data.isAdmin && model && data.balance < model.cost);
  const limit = target === 'element' && !canAddImage;

  const run = async (generate: boolean) => {
    if (job.current || disabled || !data?.allowed || !access.userId || (generate && (!model || insufficient || prompt.trim().length < 3)) || limit) return;
    const controller = new AbortController(), owner = access.userId;
    // Capture the destination callback before awaiting AI. The editor also locks
    // slide changes so the result cannot land on a subsequently selected slide.
    const insert = onInsert, destination = target;
    job.current = controller; setBusy(true); onBusyChange(true); setError('');
    const current = () => !controller.signal.aborted && job.current === controller && getStoredAuthSession()?.user?.id === owner;
    try {
      let image = retained;
      if (generate && model) {
        setPhase('AI tworzy grafikę…');
        const response = await vpsFetch<{ imageUrl?: string; error?: string }>('/ai/carousel-image', {
          method: 'POST', signal: controller.signal,
          body: JSON.stringify({ prompt: prompt.trim(), model: model.id, expectedCreditCost: model.cost, style, dimensions: destination === 'element' || format === 'square' ? '1024x1024' : '1080x1350' }),
        }, { retryAuthOnly: true });
        if (!current()) return;
        if (response.error || !response.imageUrl) throw new Error(response.error || 'Brak obrazu w odpowiedzi. Sprawdź „Moje grafiki” przed kolejną próbą.');
        image = { id: crypto.randomUUID(), src: response.imageUrl, thumbnail: response.imageUrl, name: prompt.trim().slice(0, 100) };
        setResult({ owner, image });
      }
      if (!image || !current()) return;
      setPhase('Wstawiam grafikę na slajd…');
      await insert(image, destination, controller.signal);
    } catch (reason) {
      if (current()) setError(reason instanceof Error ? reason.message : 'Generowanie nie powiodło się. Sprawdź „Moje grafiki” przed kolejną próbą.');
    } finally {
      if (job.current === controller) { job.current = null; setBusy(false); onBusyChange(false); if (generate) void access.refresh(); }
    }
  };

  if (access.loading) return <p role="status" className="text-sm text-muted-foreground">Sprawdzam dostęp do generatora…</p>;
  if (access.error) return <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{access.error}</p><Button variant="outline" onClick={() => void access.refresh()}>Odśwież dostęp</Button></div>;
  if (!data?.allowed) return <div className="space-y-4 rounded-xl border bg-primary/5 p-4"><LockKeyhole className="h-7 w-7 text-primary"/><h3 className="font-semibold">Generator AI w płatnym pakiecie</h3><p className="text-sm text-muted-foreground">Wpisz opis, wygeneruj grafikę i wstaw ją bezpośrednio do karuzeli. Odblokujesz tę funkcję po zakupie pakietu kredytów.</p><Button asChild className="h-11 w-full"><Link to={access.userId ? '/credits' : '/auth?returnTo=/tools/carousel'}>{access.userId ? 'Zobacz pakiety' : 'Zaloguj się'}</Link></Button>{access.userId && <Button variant="outline" className="w-full" onClick={() => void access.refresh()}>Mam już pakiet · odśwież dostęp</Button>}<p className="text-xs text-muted-foreground">Edycja karuzeli i pobieranie plików pozostają darmowe.</p></div>;

  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Opisz grafikę. Wynik wstawimy na slajd {slideNumber} i zapiszemy także w „Moich grafikach”.</p>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void run(true); }}>
      <div className="space-y-2"><Label htmlFor="carousel-ai-prompt">Co chcesz wygenerować?</Label><textarea id="carousel-ai-prompt" maxLength={2000} minLength={3} required rows={5} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Np. miękka ikona 3D żarówki, fiolet i róż, jasne tło, bez napisów" className="w-full resize-y rounded-lg border bg-background p-3 text-sm" disabled={busy}/><p className="text-xs text-muted-foreground">{prompt.length}/2000 · opisz obiekt, kolory i styl</p></div>
      <div className="space-y-2"><Label htmlFor="carousel-ai-model">Model AI</Label><select id="carousel-ai-model" className="h-11 w-full min-w-0 rounded-md border bg-background px-2 text-sm" value={model?.id || ''} onChange={event => setModelId(event.target.value)} disabled={busy}>{data.models.map(item => <option key={item.id} value={item.id}>{item.label} · {item.cost} kredytów</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="carousel-ai-style">Styl grafiki</Label><select id="carousel-ai-style" className="h-11 w-full rounded-md border bg-background px-2 text-sm" value={style} onChange={event => setStyle(event.target.value)} disabled={busy}><option value="illustration">Ilustracja / ikona</option><option value="realistic">Fotografia / realistyczna</option><option value="watercolor">Akwarela</option><option value="abstract">Abstrakcja</option><option value="neon">Neon</option><option value="pixel-art">Pixel art</option></select><p className="text-xs text-muted-foreground">Efekt 3D, materiały i inne szczegóły wpisz w opisie.</p></div>
      <div className="space-y-2"><Label htmlFor="carousel-ai-target">Wstaw jako</Label><select id="carousel-ai-target" className="h-11 w-full rounded-md border bg-background px-2 text-sm" value={target} onChange={event => setTarget(event.target.value as CarouselImageTarget)} disabled={busy}><option value="element">Ruchomy element na slajdzie</option><option value="photo">Zdjęcie slajdu</option><option value="background">Tło całej karuzeli</option></select></div>
      {target === 'background' && <p className="text-xs text-muted-foreground">Nowe tło zastąpi tło wszystkich slajdów. Możesz cofnąć tę zmianę.</p>}
      {limit && !busy && <p role="status" className="text-sm text-destructive">Osiągnięto limit elementów lub obrazów. Usuń jeden albo wybierz zdjęcie slajdu lub tło.</p>}
      {insufficient && <p role="status" className="text-sm text-destructive">Masz {data.balance} kredytów. Ten model wymaga {model?.cost}. <Link to="/credits" className="underline">Doładuj kredyty</Link> lub wybierz tańszy model.</p>}
      {!data.models.length && <p role="status" className="text-sm">Generator jest teraz niedostępny.</p>}
      <Button type="submit" className="h-auto min-h-11 w-full gap-2 whitespace-normal" disabled={busy || disabled || !model || insufficient || limit || prompt.trim().length < 3}>{busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin"/> : <Sparkles className="h-4 w-4 shrink-0"/>}{busy ? phase : data.isAdmin ? 'Generuj i wstaw · administrator' : `Generuj i wstaw · ${model?.cost ?? '—'} kredytów`}</Button>
      <p className="text-xs text-muted-foreground">{data.isAdmin ? 'Konto administratora: bez potrącania kredytów.' : `Saldo: ${data.balance} kredytów. Koszt obejmuje jedną grafikę.`} Zamknięcie strony nie zatrzymuje generowania. Po błędzie połączenia sprawdź „Moje grafiki” przed ponowną próbą.</p>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {retained && <div className="space-y-2 rounded-lg border p-3"><img src={retained.src} alt="Ostatnia wygenerowana grafika" className="max-h-40 w-full rounded object-contain"/><Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal" disabled={busy || disabled || limit} onClick={() => void run(false)}>Wstaw ponownie · bez generowania</Button><p className="text-xs text-muted-foreground">Ponowne wstawienie tego wyniku nie zużywa kredytów.</p></div>}
    <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => void access.refresh()}>Odśwież dostęp i saldo</Button>
  </div>;
}
