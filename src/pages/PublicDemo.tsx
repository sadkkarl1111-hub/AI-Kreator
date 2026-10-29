import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Box, Image as ImageIcon, Megaphone, PenLine, Sparkles, Wand2, X } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const LazyPublicGallery = lazy(() => import('@/components/PublicGallery').then((module) => ({ default: module.PublicGallery })));

const examples = [
  {
    id: 'ad',
    label: 'Grafika reklamowa',
    title: 'Reklamy, posty i kreacje do kampanii',
    description: 'Mocny headline, kontrast, człowiek lub produkt, czytelny CTA i format gotowy pod social media.',
    image: '/demo-assets/ad-example-ai-v2.webp',
    aspect: 'aspect-square',
    icon: Megaphone,
    width: 960,
    height: 960,
  },
  {
    id: 'mockup',
    label: 'Mockup ebooka / produktu',
    title: 'Pudełko, ebook, kurs lub produkt cyfrowy',
    description: 'Premium box w perspektywie 3D, front i grzbiet, sprzedażowy wygląd oraz realistyczne światło.',
    image: '/demo-assets/mockup-example-ai-v2.webp',
    aspect: 'aspect-[2/3]',
    icon: Box,
    width: 960,
    height: 1440,
  },
];

const PublicDemo = () => {
  const { user } = useAuth();
  const [activeExample, setActiveExample] = useState<(typeof examples)[number] | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const generatorHref = user ? '/generator' : '/auth?returnTo=/generator';

  useEffect(() => {
    const timer = window.setTimeout(() => setShowGallery(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Kreator grafik reklamowych AI
            </div>

            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-bold leading-[1.02] tracking-normal sm:text-5xl">
                Twórz grafiki reklamowe, mockupy i nie tylko.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                Grafiki, które przyciągają uwagę i pomagają sprzedawać.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to={generatorHref}>
                <Button size="lg" className="w-full gap-2 gradient-bg sm:w-auto">
                  Wygeneruj własną grafikę
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/tools">
                <Button size="lg" variant="outline" className="w-full gap-2 sm:w-auto">
                  <Wand2 className="h-4 w-4" />
                  Darmowe narzędzia
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {examples.map((example) => {
              const Icon = example.icon;

              return (
                <article key={example.id} className="overflow-hidden rounded-[8px] border bg-card shadow-sm">
                  <button
                    type="button"
                    aria-label={`Powiększ: ${example.label}`}
                    onClick={() => setActiveExample(example)}
                    className={`relative block w-full ${example.aspect} overflow-hidden bg-slate-950`}
                  >
                    <img
                      src={example.image}
                      alt={`${example.label} — wygenerowano przy użyciu AI`}
                      className="h-full w-full object-contain"
                      width={example.width}
                      height={example.height}
                      loading={example.id === 'ad' ? 'eager' : 'lazy'}
                      fetchPriority={example.id === 'ad' ? 'high' : 'auto'}
                      decoding="async"
                    />
                  </button>
                  <div className="space-y-2 p-4">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground"><Icon className="h-3.5 w-3.5"/>{example.label}</div>
                    <h2 className="text-lg font-bold leading-tight">{example.title}</h2>
                    <p className="text-sm leading-6 text-muted-foreground">{example.description}</p>
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><Sparkles className="h-3.5 w-3.5 shrink-0"/>Wygenerowano przy użyciu AI</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-[8px] border bg-card p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-semibold">
                <ImageIcon className="h-4 w-4 text-primary" />
                Darmowe narzędzia są dostępne od razu
              </p>
              <p className="text-sm text-muted-foreground">
                Możesz tworzyć prompty do reklam i mockupów, kadrować, kompresować, konwertować formaty, robić QR, PDF, mockupy i resize pod social media.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 md:w-auto">
              <Link to="/tools/prompt-generator">
                <Button variant="outline" className="w-full gap-2">
                  <PenLine className="h-4 w-4" />
                  Prompty Pro
                </Button>
              </Link>
              <Link to="/tools">
                <Button variant="outline" className="w-full">
                  Otwórz narzędzia
                </Button>
              </Link>
              <Link to="/galeria-publiczna">
                <Button variant="outline" className="w-full gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Galeria publiczna
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section id="galeria-publiczna" className="rounded-[8px] border bg-card p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <ImageIcon className="h-5 w-5 text-primary" />
                Galeria publiczna
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Zobacz przykładowe grafiki stworzone w aplikacji i kopiuj prompty jako inspirację do własnych projektów.
              </p>
            </div>
            <Link to="/galeria-publiczna">
              <Button variant="ghost" className="w-full sm:w-auto">
                Zobacz więcej
              </Button>
            </Link>
          </div>
          {showGallery ? (
            <Suspense fallback={<div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-square rounded-xl bg-muted" />)}</div>}>
              <LazyPublicGallery limit={8} title="" className="w-full max-w-none" />
            </Suspense>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-square rounded-xl bg-muted" />)}
            </div>
          )}
        </section>

        {activeExample && (
          <div role="dialog" aria-modal="true" aria-label={`Podgląd: ${activeExample.label}`} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              aria-label="Zamknij podgląd"
              onClick={() => setActiveExample(null)}
            />
            <div className="relative z-10">
              <button
                type="button"
                aria-label="Zamknij podgląd"
                onClick={() => setActiveExample(null)}
                className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={activeExample.image}
                alt={`${activeExample.label} — wygenerowano przy użyciu AI`}
                className="max-h-[86vh] max-w-[92vw] rounded-[8px] object-contain shadow-2xl"
                width={activeExample.width}
                height={activeExample.height}
                decoding="async"
              />
              <p className="rounded-b-lg bg-slate-950 px-3 py-2 text-center text-xs text-white">Wygenerowano przy użyciu AI</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default PublicDemo;
