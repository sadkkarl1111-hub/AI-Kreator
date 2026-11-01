import catalog from '@/data/gif-library.json';

export const GIF_LIBRARY = catalog;
export type LibraryGif = (typeof GIF_LIBRARY)[number];
export const GIF_CATEGORIES = [...new Set(GIF_LIBRARY.map(gif => gif.category))];

export function normalizeGifSearch(value: string) {
  return value.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').trim();
}

export function filterGifs(query: string, category: string) {
  const words = normalizeGifSearch(query).split(/\s+/).filter(Boolean);
  return GIF_LIBRARY.filter(gif => (category === 'Wszystkie' || gif.category === category)
    && words.every(word => normalizeGifSearch(`${gif.title} ${gif.keywords} ${gif.category}`).includes(word)));
}
