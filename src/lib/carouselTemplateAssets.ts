import type { CarouselDocument } from './carouselHistory';
import { applyCarouselTemplate, CAROUSEL_TEMPLATES } from './carouselTemplates';
import type { CarouselDesign, CarouselSlide } from './carouselDesign';

let fontReady: Promise<unknown> | undefined;
export function ensureCarouselFonts(design: CarouselDesign, slides: readonly CarouselSlide[] = []) {
  const usesAnton = design.titleFont === 'anton' || design.bodyFont === 'anton' || slides.some(slide => [slide.titleMarks, slide.bodyMarks, slide.kickerMarks].some(marks => marks?.some(mark => mark.font === 'anton')));
  if (!usesAnton || !document.fonts?.load) return Promise.resolve();
  return fontReady ||= document.fonts.load('32px Anton').catch(error => { fontReady = undefined; throw error; });
}

const sampleCache = new Map<string, Promise<string>>();
export function loadCarouselTemplateSample(url: string): Promise<string> {
  let pending = sampleCache.get(url);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Nie udało się wczytać przykładowego zdjęcia. Odznacz je lub spróbuj ponownie.');
      const blob = await response.blob();
      if (!['image/png', 'image/webp'].includes(blob.type) || blob.size > 4_000_000) throw new Error('Niepoprawne zdjęcie szablonu.');
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Nie udało się odczytać zdjęcia szablonu.'));
        reader.readAsDataURL(blob);
      });
    })().catch(error => { sampleCache.delete(url); throw error; });
    sampleCache.set(url, pending);
  }
  return pending;
}

export async function prepareCarouselTemplate(project: CarouselDocument, id: string, includeSample: boolean, loader = loadCarouselTemplateSample) {
  const template = CAROUSEL_TEMPLATES.find(item => item.id === id);
  if (!template) return project;
  const next = applyCarouselTemplate(project, id);
  await ensureCarouselFonts(next.design, next.slides);
  if (includeSample && template.sampleImage) {
    const image = await loader(template.sampleImage);
    next.slides[0] = { ...next.slides[0], image, imageSource: 'ai-sample' };
  }
  return next;
}
