import { CAROUSEL_BACKGROUNDS, CAROUSEL_THEMES, CAROUSEL_TONES, defaultCarouselDesign, type CarouselDesign, type CarouselSlide } from './carouselDesign';
import { CAROUSEL_FONTS, validateTextMarks } from './carouselRichText';
import { validateStickers } from './carouselStickers';
import { CAROUSEL_IMAGE_FRAMES } from './carouselFrames';
import { validateCarouselTextFrames } from './carouselTextGeometry';
import { validateCarouselNavigation } from './carouselNavigation';
import { CAROUSEL_COMPOSITIONS, validateCarouselCta } from './carouselConversion';

const imageData = (value: unknown) => {
  if (value === '' || value === undefined) return '';
  if (typeof value !== 'string' || value.length > 24_000_000 || !/^data:image\/(png|jpeg|webp);base64,[a-z\d+/]+=*$/i.test(value)) throw new Error('Projekt zawiera niepoprawny obraz.');
  return value;
};
const text = (value: unknown, maximum: number) => { if (typeof value !== 'string' || value.length > maximum) throw new Error('Projekt zawiera niepoprawny tekst.'); return value; };
const choice = <T extends string>(value: unknown, values: readonly T[]): T => { if (!values.includes(value as T)) throw new Error('Projekt zawiera niepoprawne ustawienia.'); return value as T; };
const color = (value: unknown) => { if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new Error('Projekt zawiera niepoprawny kolor.'); return value; };

export function parseCarouselProject(source: string): { slides: CarouselSlide[]; design: CarouselDesign } {
  if (source.length > 24_000_000) throw new Error('Projekt może mieć maksymalnie 24 MB.');
  let parsed;
  try { parsed = JSON.parse(source); } catch { throw new Error('Nie udało się odczytać projektu karuzeli.'); }
  if (parsed?.version !== 1 || !Array.isArray(parsed.slides) || parsed.slides.length < 1 || parsed.slides.length > 10 || !parsed.design) throw new Error('Niepoprawny projekt karuzeli.');
  const raw = parsed.design;
  const design: CarouselDesign = {
    ...defaultCarouselDesign,
    ...(raw.navigation !== undefined ? { navigation: validateCarouselNavigation(raw.navigation) } : {}),
    format: choice(raw.format, ['portrait', 'square']), theme: choice(raw.theme, CAROUSEL_THEMES.map(theme => theme.id)),
    brand: text(raw.brand, 42), accent: color(raw.accent), logo: imageData(raw.logo),
    brandMode: choice(raw.brandMode ?? 'both', ['text', 'logo', 'both']), logoSize: Math.max(32, Math.min(90, Number(raw.logoSize) || 64)), logoPlate: raw.logoPlate === true,
    background: choice(raw.background ?? 'theme', CAROUSEL_BACKGROUNDS.map(item => item.id)), backgroundColor: color(raw.backgroundColor ?? '#17142b'),
    backgroundImage: imageData(raw.backgroundImage), backgroundShield: Math.max(0, Math.min(95, Number(raw.backgroundShield) || 0)),
    titleFont: choice(raw.titleFont ?? 'theme', CAROUSEL_FONTS.map(item => item.id)), bodyFont: choice(raw.bodyFont ?? 'theme', CAROUSEL_FONTS.map(item => item.id)),
    titleScale: Math.max(80, Math.min(140, Number(raw.titleScale) || 100)), bodyScale: Math.max(80, Math.min(140, Number(raw.bodyScale) || 100)),
  };
  if (!Number.isFinite(design.logoSize) || !Number.isFinite(design.backgroundShield)) throw new Error('Niepoprawne ustawienia projektu.');
  const slides = parsed.slides.map((slide: Record<string, unknown>) => {
    if (!slide || typeof slide !== 'object') throw new Error('Niepoprawny slajd.');
    const title = text(slide.title, 100), body = text(slide.body, 500), kicker = text(slide.kicker, 40);
    const tone = slide.tone === undefined ? undefined : choice(slide.tone, CAROUSEL_TONES.map(item => item.id));
    const imageSource = slide.imageSource === undefined ? undefined : choice(slide.imageSource, ['ai-sample']);
    return { id: crypto.randomUUID(), layout: choice(slide.layout, ['cover', 'content', 'quote']), kicker, title, body, ...(tone ? { tone } : {}), ...(imageSource ? { imageSource } : {}), ...(slide.composition !== undefined ? { composition: choice(slide.composition, CAROUSEL_COMPOSITIONS.map(item => item.id)) } : {}), ...(slide.cta !== undefined ? { cta: validateCarouselCta(slide.cta) } : {}), image: imageData(slide.image), ...(slide.imageFrame !== undefined ? { imageFrame: choice(slide.imageFrame, CAROUSEL_IMAGE_FRAMES.map(frame => frame.id)) } : {}), ...(slide.textFrames !== undefined ? { textFrames: validateCarouselTextFrames(slide.textFrames) } : {}), ...(slide.kickerMarks !== undefined ? { kickerMarks: validateTextMarks(slide.kickerMarks, kicker) } : {}), titleMarks: validateTextMarks(slide.titleMarks, title), bodyMarks: validateTextMarks(slide.bodyMarks, body), stickers: validateStickers(slide.stickers) };
  });
  return { design, slides };
}

export function serializeCarouselProject(slides: CarouselSlide[], design: CarouselDesign) {
  const result = JSON.stringify({ version: 1, slides, design });
  if (result.length > 24_000_000) throw new Error('Projekt jest zbyt duży. Zmniejsz liczbę zdjęć przed zapisem.');
  return result;
}
