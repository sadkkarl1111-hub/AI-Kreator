import { ensureCarouselFonts } from '@/lib/carouselTemplateAssets';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { renderCarouselSlide, type CarouselDesign, type CarouselSlide } from '@/lib/carouselDesign';
import { decodeLocalImage } from '@/lib/localDesignExport';
import { applyCarouselComposition, applyCarouselCta, CAROUSEL_COMPOSITIONS, CAROUSEL_CTA_PRESETS, type CarouselComposition } from '@/lib/carouselConversion';

function CompositionPreview({ slide, design, composition }: { slide: CarouselSlide; design: CarouselDesign; composition: CarouselComposition }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const preview = applyCarouselComposition(slide, composition);
        // Keep the previews readable independently of the user's current word marks.
        const sample = { ...preview, kicker: composition.startsWith('ending-') ? 'TWÓJ KOLEJNY KROK' : 'TWÓJ TEMAT', title: composition.startsWith('ending-') ? 'Zrób następny krok' : 'Pomysł, który warto pokazać', body: 'Krótka myśl. Wyraźny przekaz.', titleMarks: [], bodyMarks: [], kickerMarks: [], stickers: [], cta: composition.startsWith('ending-') ? { text: 'Sprawdź szczegóły', style: 'pill' as const } : undefined };
        await ensureCarouselFonts(design, [slide]);
        const [image, logo, background] = await Promise.all([sample.image ? decodeLocalImage(sample.image) : null, design.logo ? decodeLocalImage(design.logo) : null, design.backgroundImage ? decodeLocalImage(design.backgroundImage) : null]);
        if (cancelled || !canvas.current) return;
        const source = document.createElement('canvas'); renderCarouselSlide(source, sample, design, 0, 5, image, { logo, background });
        const target = canvas.current; target.width = 160; target.height = design.format === 'square' ? 160 : 200; target.getContext('2d')?.drawImage(source,0,0,target.width,target.height); source.width = source.height = 1;
      } catch { /* The preset name stays available if project media cannot load. */ }
    })();
    return () => { cancelled = true; };
  }, [slide, design, composition]);
  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none h-28 w-full rounded object-contain"/>;
}
export function CarouselConversionEditor({ slide, design, slideNumber, slideCount, onChange, onReveal }: { slide: CarouselSlide; design: CarouselDesign; slideNumber: number; slideCount: number; onChange: (slide: CarouselSlide, group?: string) => void; onReveal: () => void }) {
  const [tab, setTab] = useState<'cover' | 'ending'>('cover');
  const [ctaPreset, setCtaPreset] = useState('save');
  const apply = (composition: CarouselComposition) => { onChange(applyCarouselComposition(slide, composition)); onReveal(); };
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Zmieniasz tylko slajd {slideNumber} z {slideCount}. Wybierz pierwszy slajd dla okładki lub ostatni dla zakończenia.</p>
    <div className="grid grid-cols-2 gap-2"><Button variant={tab === 'cover' ? 'default' : 'outline'} aria-pressed={tab === 'cover'} onClick={() => setTab('cover')}>Okładki</Button><Button variant={tab === 'ending' ? 'default' : 'outline'} aria-pressed={tab === 'ending'} onClick={() => setTab('ending')}>Zakończenia</Button></div>
    <div className="grid grid-cols-2 gap-2">{CAROUSEL_COMPOSITIONS.filter(item => item.kind === tab).map(item => <Button key={item.id} variant={slide.composition === item.id ? 'default' : 'outline'} aria-pressed={slide.composition === item.id} title={item.description} className="h-auto flex-col gap-2 whitespace-normal px-2 py-3 text-xs" onClick={() => apply(item.id)}><CompositionPreview slide={slide} design={design} composition={item.id}/>{item.name}</Button>)}</div>
    <p className="text-xs text-muted-foreground">Wybór układu zachowuje treść, wyróżnienia słów, zdjęcie i naklejki. Przywraca położenie napisów do wybranego układu. Możesz cofnąć zmianę.</p>
    {tab === 'cover' && <><p className="text-xs text-muted-foreground">Na okładce nazwij konkretną korzyść lub problem. Własne zdjęcie dodasz w „Grafiki”.</p><Button variant="outline" className="h-auto min-h-10 w-full whitespace-normal text-xs" onClick={() => { onChange({ ...applyCarouselComposition(slide, undefined), cta: undefined }); onReveal(); }}>Przywróć standardowy układ slajdu</Button></>}
    {tab === 'ending' && <div className="space-y-3 rounded-xl border p-3"><h3 className="text-sm font-semibold">Gotowe wezwanie do działania</h3>
      <Label htmlFor="carousel-cta-goal">Cel zakończenia</Label><select id="carousel-cta-goal" value={ctaPreset} onChange={event => setCtaPreset(event.target.value)} className="h-11 w-full rounded border bg-background px-2 text-sm">{CAROUSEL_CTA_PRESETS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <div className="rounded-lg bg-muted p-3 text-xs"><p className="font-semibold">{CAROUSEL_CTA_PRESETS.find(item => item.id === ctaPreset)?.title}</p><p className="mt-1">{CAROUSEL_CTA_PRESETS.find(item => item.id === ctaPreset)?.body}</p></div>
      <Button className="h-auto min-h-11 w-full whitespace-normal" onClick={() => { onChange(applyCarouselCta(slide, ctaPreset)); onReveal(); }}>Wstaw tekst zakończenia na ten slajd</Button>
      <p className="text-xs text-muted-foreground">Zastępuje nagłówek, treść, etykietę i ich formatowanie. Zdjęcie i naklejki zostają. Możesz użyć „Cofnij”.</p>
    </div>}
    <details className="rounded-xl border p-3" open={Boolean(slide.cta)}><summary className="cursor-pointer text-sm font-semibold">Wyróżniony przycisk / wezwanie</summary><div className="mt-3 space-y-3">
      <Label htmlFor="carousel-cta-text">Tekst wezwania</Label><input id="carousel-cta-text" value={slide.cta?.text || ''} maxLength={36} placeholder="Np. Sprawdź ofertę w bio" onChange={event => onChange({ ...slide, cta: { ...slide.cta, style: slide.cta?.style || 'pill', text: event.target.value } }, 'cta-text')} className="h-11 w-full rounded border bg-background px-2 text-sm"/>
      <Label htmlFor="carousel-cta-style">Wygląd wezwania</Label><select id="carousel-cta-style" value={slide.cta?.style || 'pill'} onChange={event => onChange({ ...slide, cta: { text: slide.cta?.text || 'Sprawdź szczegóły', ...slide.cta, style: event.target.value as 'solid' | 'outline' | 'pill' } })} className="h-11 w-full rounded border bg-background px-2 text-sm"><option value="pill">Kapsułka</option><option value="solid">Wypełniony</option><option value="outline">Obrys</option></select>
      <label className="flex items-center justify-between text-xs">Kolor wezwania<input aria-label="Kolor wezwania" type="color" value={slide.cta?.color || design.accent} className="h-9 w-12 rounded border" onChange={event => onChange({ ...slide, cta: { text: slide.cta?.text || 'Sprawdź szczegóły', style: slide.cta?.style || 'pill', ...slide.cta, color: event.target.value } })}/></label>
      <Button variant="ghost" size="sm" onClick={() => onChange({ ...slide, cta: undefined })}>Usuń wyróżnione wezwanie</Button>
      <p className="text-xs text-muted-foreground">To element graficzny. W PNG, PDF i na Instagramie nie jest klikalnym linkiem. Podaj jedno konkretne działanie, które odbiorca może wykonać.</p>
    </div></details>
  </div>;
}
