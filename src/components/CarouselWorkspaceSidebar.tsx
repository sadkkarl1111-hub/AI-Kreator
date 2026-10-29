import { useLayoutEffect, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { LayoutTemplate, Type, Shapes, ImagePlus, Fingerprint, Wallpaper, SlidersHorizontal, Download, Sparkles, LockKeyhole, Navigation, PanelsTopLeft } from 'lucide-react';

const CAROUSEL_PANELS = [
  { id: 'templates', label: 'Szablony', icon: LayoutTemplate },
  { id: 'conversion', label: 'Okładki i CTA', icon: PanelsTopLeft },
  { id: 'text', label: 'Tekst', icon: Type },
  { id: 'elements', label: 'Elementy', icon: Shapes },
  { id: 'media', label: 'Grafiki', icon: ImagePlus },
  { id: 'generator', label: 'Generator AI', icon: Sparkles },
  { id: 'brand', label: 'Marka', icon: Fingerprint },
  { id: 'background', label: 'Tło', icon: Wallpaper },
  { id: 'style', label: 'Styl i format', icon: SlidersHorizontal },
  { id: 'navigation', label: 'Nawigacja', icon: Navigation },
  { id: 'export', label: 'Pobieranie', icon: Download },
] as const;
export type CarouselPanel = typeof CAROUSEL_PANELS[number]['id'];

export function CarouselWorkspaceSidebar({ active, onChange, panels, disabled, generatorLocked = true }: { active: CarouselPanel; onChange: (panel: CarouselPanel) => void; panels: Record<CarouselPanel, ReactNode>; disabled: boolean; generatorLocked?: boolean }) {
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { content.current?.scrollTo?.({ top: 0 }); }, [active]);
  const choose = (panel: CarouselPanel) => { onChange(panel); content.current?.scrollTo?.({ top: 0 }); };
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = (index + 1) % CAROUSEL_PANELS.length;
    else if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = (index + CAROUSEL_PANELS.length - 1) % CAROUSEL_PANELS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = CAROUSEL_PANELS.length - 1;
    else return;
    event.preventDefault(); choose(CAROUSEL_PANELS[next].id); document.getElementById(`carousel-tab-${CAROUSEL_PANELS[next].id}`)?.focus();
  };
  return <aside id="carousel-editor" className="carousel-workspace-sidebar scroll-mt-20" aria-label="Narzędzia karuzeli">
    <a href="#carousel-preview" className="m-3 block rounded-md border p-3 text-center text-sm hover:bg-muted lg:hidden">Wróć do podglądu ↑</a>
    <div className="carousel-workspace-rail" role="tablist" aria-label="Sekcje edytora">{CAROUSEL_PANELS.map(({ id, label, icon: Icon }, index) => <button key={id} id={`carousel-tab-${id}`} type="button" role="tab" aria-selected={active === id} aria-controls={`carousel-panel-${id}`} tabIndex={active === id ? 0 : -1} onKeyDown={event => keyboard(event, index)} onClick={() => choose(id)} className={`flex min-h-16 min-w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active === id ? 'bg-primary/15 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><span className="relative"><Icon className="h-5 w-5"/>{id === 'generator' && generatorLocked && <LockKeyhole aria-label="Wymaga płatnego pakietu" className="absolute -right-2 -top-1 h-3 w-3 rounded-sm bg-card"/>}</span>{label}</button>)}</div>
    <div ref={content} className="carousel-workspace-settings">{CAROUSEL_PANELS.map(({ id, label }) => <section key={id} id={`carousel-panel-${id}`} role="tabpanel" aria-labelledby={`carousel-tab-${id}`} hidden={active !== id} tabIndex={0} className="min-w-0 space-y-4 p-4 focus-visible:outline-none"><h2 className="text-base font-semibold">{label}</h2><fieldset disabled={disabled && id !== 'export'} className="min-w-0 space-y-4">{panels[id]}</fieldset></section>)}</div>
  </aside>;
}
