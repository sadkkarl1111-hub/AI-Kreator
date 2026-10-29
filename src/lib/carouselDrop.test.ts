import { describe, expect, it } from 'vitest';
import { carouselDropPoint } from './carouselDrop';
import { CAROUSEL_DECORATIONS } from './carouselDecorations';
import { createCarouselSticker, MAX_CAROUSEL_ELEMENTS, validateStickers } from './carouselStickers';
import { applyCarouselTemplate } from './carouselTemplates';
import { defaultCarouselDesign, initialCarouselSlides } from './carouselDesign';
import { parseCarouselProject, serializeCarouselProject } from './carouselProject';
describe('carousel drop coordinates', () => {
  it('places elements in the real painted slide rather than the letterboxed canvas box', () => {
    const rect = { left: 10, top: 20, width: 800, height: 500 };
    expect(carouselDropPoint(rect, 1080, 1350, 310, 145)).toEqual({ x: 25, y: 25 });
    expect(carouselDropPoint(rect, 1080, 1350, 410, 270)).toEqual({ x: 50, y: 50 });
    expect(carouselDropPoint(rect, 1080, 1350, 100, 270)).toBeNull();
    expect(carouselDropPoint(rect, 1080, 1350, 410, 19)).toBeNull();
  });
  it('handles square and mobile layouts and rejects invalid dimensions or points', () => {
    const rect = { left: 10, top: 60, width: 280, height: 350 };
    expect(carouselDropPoint(rect, 1080, 1350, 150, 235)).toEqual({ x: 50, y: 50 });
    expect(carouselDropPoint(rect, 1080, 1080, 150, 235)).toEqual({ x: 50, y: 50 });
    expect(carouselDropPoint({ ...rect, width: 0 }, 1080, 1350, 150, 235)).toBeNull();
    expect(carouselDropPoint(rect, 1080, 1350, NaN, 235)).toBeNull();
  });
});
describe('decorative carousel elements', () => {
  it('creates all 24 new decorations with valid defaults and preserves larger paper elements in project files', () => {
    expect(CAROUSEL_DECORATIONS).toHaveLength(24);
    for (const item of CAROUSEL_DECORATIONS) {
      const element = createCarouselSticker(item.id, '#aa3377', 21, 64)!;
      expect(validateStickers([element])).toEqual([element]); expect(element).toMatchObject({ kind: item.id, x: 21, y: 64, motion: 'none' });
    }
    const element = { ...createCarouselSticker('sticky-note', '#ffcc00')!, size: 60 };
    const result = parseCarouselProject(serializeCarouselProject([{ ...initialCarouselSlides[0], id: 'one', stickers: [element] }], defaultCarouselDesign));
    expect(result.slides[0].stickers).toEqual([element]);
    expect(createCarouselSticker('unknown', '#ffcc00')).toBeNull(); expect(createCarouselSticker('pushpin', '#ffcc00', NaN, 0)).toBeNull();
  });
  it('allows 16 vector elements but preserves the 8-custom-image resource limit', () => {
    const elements = Array.from({ length: MAX_CAROUSEL_ELEMENTS }, () => createCarouselSticker('pushpin', '#ffcc00')!);
    expect(validateStickers(elements)).toHaveLength(16); expect(() => validateStickers([...elements, createCarouselSticker('tape', '#ffcc00')!])).toThrow();
    const custom = elements.slice(0, 9).map(item => ({ ...item, kind: 'custom', asset: { name: 'image.png', data: 'data:image/png;base64,AAAA' } }));
    expect(() => validateStickers(custom)).toThrow(/8 własnych/);
  });
  it('gives new templates editable decoration layers with unique identities and supports independent duplicates', () => {
    const document = { design: defaultCarouselDesign, slides: [{ ...initialCarouselSlides[0], id: 'original' }] };
    for (const id of ['scrapbook', 'moodboard', 'checklist', 'event-board', 'case-study', 'pinned-tips']) {
      const project = applyCarouselTemplate(document, id), duplicate = applyCarouselTemplate(document, id);
      for (const slide of project.slides) {
        expect(slide.stickers!.length).toBeGreaterThan(2); expect(validateStickers(slide.stickers)).toEqual(slide.stickers);
        expect(new Set(slide.stickers!.map(item => item.id)).size).toBe(slide.stickers!.length);
      }
      expect(project.slides[0].stickers![0].id).not.toBe(duplicate.slides[0].stickers![0].id);
    }
  });
});
