import type { CarouselSlide } from './carouselDesign';
export const CAROUSEL_COMPOSITIONS = [
  { id: 'cover-bold', name: 'Mocny nagłówek', kind: 'cover', description: 'Duży nagłówek i wyraźny akcent' },
  { id: 'cover-center', name: 'Typografia w centrum', kind: 'cover', description: 'Symetryczny układ z oddechem' },
  { id: 'cover-marker', name: 'Wyróżniona obietnica', kind: 'cover', description: 'Kolorowa podkładka pod nagłówkiem' },
  { id: 'cover-photo', name: 'Okładka ze zdjęciem', kind: 'cover', description: 'Miejsce na własne zdjęcie lub autora' },
  { id: 'creator-cover', name: 'Twórca · plakat', kind: 'cover', description: 'Wielka typografia, wycięta postać i mocny kontrast' },
  { id: 'creator-portrait', name: 'Twórca · portret', kind: 'cover', description: 'Duża postać i nagłówek w dwóch sąsiednich kolumnach' },
  { id: 'creator-number', name: 'Twórca · duża liczba', kind: 'cover', description: 'Numer kroku w tle i jedna konkretna wskazówka' },
  { id: 'creator-split', name: 'Twórca · porównanie', kind: 'cover', description: 'Dwie edytowalne myśli obok siebie: mit i fakt, przed i po' },
  { id: 'creator-story', name: 'Twórca · historia', kind: 'cover', description: 'Zdjęcie i tekst ułożone jak w magazynie' },
  { id: 'ending-card', name: 'Karta działania', kind: 'ending', description: 'Podsumowanie z wyraźnym wezwaniem' },
  { id: 'ending-minimal', name: 'Proste zakończenie', kind: 'ending', description: 'Jedno konkretne działanie' },
  { id: 'ending-creator', name: 'Twórca · finał', kind: 'ending', description: 'Krótka puenta i duże wezwanie do działania' },
] as const;
export type CarouselComposition = typeof CAROUSEL_COMPOSITIONS[number]['id'];
export type CarouselCta = { text: string; style: 'solid' | 'outline' | 'pill'; color?: string };
export const CAROUSEL_CTA_PRESETS = [
  { id: 'save', label: 'Zapisy', kicker: 'ZACHOWAJ NA PÓŹNIEJ', title: 'Wróć do tego, gdy będzie potrzebne', body: 'Zapisz tę karuzelę, żeby mieć wskazówki pod ręką.', cta: 'Zapisz na później' },
  { id: 'message', label: 'Wiadomości', kicker: 'POROZMAWIAJMY', title: 'Potrzebujesz rozwiązania dla siebie?', body: 'Napisz wiadomość i opisz, z czym chcesz ruszyć dalej.', cta: 'Napisz do mnie' },
  { id: 'offer', label: 'Oferta', kicker: 'TWÓJ NASTĘPNY KROK', title: 'Sprawdź, jak możemy Ci pomóc', body: 'Szczegóły i dostępne możliwości znajdziesz pod linkiem w bio.', cta: 'Sprawdź ofertę w bio' },
  { id: 'follow', label: 'Obserwacje', kicker: 'ZOSTAŃ NA DŁUŻEJ', title: 'Chcesz więcej takich wskazówek?', body: 'Obserwuj profil i wracaj po kolejne praktyczne materiały.', cta: 'Obserwuj profil' },
] as const;
export function applyCarouselComposition(slide: CarouselSlide, composition: CarouselComposition | undefined): CarouselSlide {
  // Layout choices affect this slide only; media, copy and word formatting survive.
  return { ...slide, layout: 'cover', composition, textFrames: {} };
}
export function applyCarouselCta(slide: CarouselSlide, id: string): CarouselSlide {
  const preset = CAROUSEL_CTA_PRESETS.find(item => item.id === id); if (!preset) return slide;
  return { ...slide, layout: 'cover', composition: slide.composition?.startsWith('ending-') ? slide.composition : 'ending-card', kicker: preset.kicker, title: preset.title, body: preset.body, titleMarks: [], bodyMarks: [], kickerMarks: [], textFrames: {}, cta: { text: preset.cta, style: slide.cta?.style || 'pill', ...(slide.cta?.color ? { color: slide.cta.color } : {}) } };
}
export function validateCarouselCta(value: unknown): CarouselCta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Niepoprawne wezwanie do działania.');
  const raw = value as Record<string, unknown>;
  if (typeof raw.text !== 'string' || raw.text.length > 36 || !['solid', 'outline', 'pill'].includes(String(raw.style))) throw new Error('Niepoprawny podpis lub wygląd wezwania.');
  if (raw.color !== undefined && (typeof raw.color !== 'string' || !/^#[\da-f]{6}$/i.test(raw.color))) throw new Error('Niepoprawny kolor wezwania.');
  return { text: raw.text, style: raw.style as CarouselCta['style'], ...(typeof raw.color === 'string' ? { color: raw.color } : {}) };
}
export function carouselContrast(color: string) {
  const luminance = .299 * parseInt(color.slice(1,3),16) + .587 * parseInt(color.slice(3,5),16) + .114 * parseInt(color.slice(5,7),16);
  return luminance > 155 ? '#172033' : '#ffffff';
}
