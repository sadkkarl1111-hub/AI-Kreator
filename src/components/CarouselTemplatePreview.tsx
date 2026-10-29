import { useEffect, useRef } from 'react';
import { defaultCarouselDesign, initialCarouselSlides, renderCarouselSlide } from '@/lib/carouselDesign';
import { applyCarouselTemplate } from '@/lib/carouselTemplates';
import { CAROUSEL_TEMPLATES } from '@/lib/carouselTemplates';
import { ensureCarouselFonts } from '@/lib/carouselTemplateAssets';
import { decodeLocalImage } from '@/lib/localDesignExport';
export function CarouselTemplatePreview({ id, slideIndex = 0, sample = true, compact = false }: { id: string; slideIndex?: number; sample?: boolean; compact?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const context = canvas.current?.getContext('2d'); if (!context) return;
      const project = applyCarouselTemplate({ slides: initialCarouselSlides.map((slide, index) => ({ ...slide, id: String(index) })), design: defaultCarouselDesign }, id);
      const template = CAROUSEL_TEMPLATES.find(item => item.id === id);
      const index = Math.min(slideIndex, project.slides.length - 1);
      const slide = { ...project.slides[index] };
      await ensureCarouselFonts(project.design, project.slides);
      const image = sample && index === 0 && template?.sampleImage ? await decodeLocalImage(template.sampleImage).catch(() => null) : null;
      if (image) { slide.image = template!.sampleImage!; slide.imageSource = 'ai-sample'; }
      if (cancelled) return;
      const source = document.createElement('canvas');
      renderCarouselSlide(source, slide, project.design, index, project.slides.length, image);
      context.clearRect(0, 0, 160, 200); context.drawImage(source, 0, 0, 160, 200); source.width = source.height = 1;
    };
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer!.disconnect(); void draw().catch(() => {}); }
    }, { rootMargin: '150px' }) : null;
    if (observer && canvas.current) observer.observe(canvas.current); else void draw().catch(() => {});
    return () => { cancelled = true; observer?.disconnect(); };
  }, [id, slideIndex, sample]);
  return <canvas ref={canvas} width={160} height={200} aria-hidden="true" className={`pointer-events-none mx-auto w-full rounded object-contain ${compact ? 'h-24' : 'h-36'}`}/>;
}
