import { describe, expect, it, vi } from 'vitest';
import { carouselSlideDesign, defaultCarouselDesign, initialCarouselSlides, type CarouselSlide } from './carouselDesign';
import { CAROUSEL_TEMPLATES, applyCarouselTemplate } from './carouselTemplates';
import { prepareCarouselTemplate } from './carouselTemplateAssets';
import { parseCarouselProject, serializeCarouselProject } from './carouselProject';
import { carouselHistoryReducer, createCarouselHistory } from './carouselHistory';

const project = () => ({ design: { ...defaultCarouselDesign, format: 'square' as const, brand: '@mojamarka', logo: 'data:image/png;base64,AA==', brandMode: 'logo' as const }, slides: initialCarouselSlides.map((slide, index) => ({ ...slide, id: `old-${index}` })) });
const creators = CAROUSEL_TEMPLATES.filter(item => item.collection === 'creator');
describe('creator carousel templates', () => {
  it('round-trips all new sets with per-slide tones, word styling, composition, navigation and CTA', () => {
    expect(creators).toHaveLength(12);
    for (const template of creators) {
      const next = applyCarouselTemplate(project(), template.id);
      const roundTrip = parseCarouselProject(serializeCarouselProject(next.slides, next.design));
      expect(roundTrip.design, template.id).toMatchObject({ brand: '@mojamarka', format: 'square', logo: 'data:image/png;base64,AA==', brandMode: 'logo', titleFont: 'anton' });
      expect(roundTrip.slides.map(({ id, ...slide }) => slide), template.id).toEqual(next.slides.map(({ id, ...slide }) => slide));
      expect(roundTrip.slides.at(-1)?.composition).toBe('ending-creator');
      expect(roundTrip.slides.at(-1)?.cta?.text.length).toBeGreaterThan(0);
      expect(new Set(next.slides.map(slide => slide.tone)).size).toBeGreaterThanOrEqual(3);
    }
  });

  it('does not share nested styles, navigation or CTA objects across applications', () => {
    const first = applyCarouselTemplate(project(), creators[0].id);
    const second = applyCarouselTemplate(project(), creators[0].id);
    first.slides[0].titleMarks![0].color = '#123456';
    first.slides.at(-1)!.cta!.text = 'changed';
    first.design.navigation!.caption = 'changed';
    expect(second.slides[0].titleMarks![0].color).not.toBe('#123456');
    expect(second.slides.at(-1)!.cta!.text).not.toBe('changed');
    expect(second.design.navigation!.caption).not.toBe('changed');
  });

  it('uses a contrasting marker on accent-colored covers', () => {
    const next = applyCarouselTemplate(project(), 'creator-save');
    expect(next.slides[0].tone).toBe('accent');
    expect(next.slides[0].titleMarks![0]).toMatchObject({ highlight: '#172033', color: '#ffffff' });
  });

  it('keeps old documents readable and rejects unknown tones and image provenance', () => {
    const source = project();
    expect(parseCarouselProject(serializeCarouselProject(source.slides, source.design)).slides[0].tone).toBeUndefined();
    for (const patch of [{ tone: 'execute' }, { imageSource: 'remote' }]) {
      expect(() => parseCarouselProject(serializeCarouselProject([{ ...source.slides[0], ...patch } as CarouselSlide], source.design))).toThrow();
    }
  });

  it('keeps the selected accent background stable between background and foreground passes', () => {
    const design = { ...defaultCarouselDesign, accent: '#f43d36' };
    expect(carouselSlideDesign(design, 'accent')).toMatchObject({ backgroundColor: '#f43d36', accent: '#ffffff' });
    expect(carouselSlideDesign(design, 'dark')).toMatchObject({ backgroundColor: '#101114', accent: '#f43d36' });
    expect(carouselSlideDesign(design, 'light')).toMatchObject({ backgroundColor: '#f8f5ef', accent: '#f43d36' });
    expect(design.accent).toBe('#f43d36');
  });

  it('loads sample media only when requested, labels it and embeds it in the portable project', async () => {
    const loader = vi.fn(async () => 'data:image/webp;base64,AA==');
    const source = project();
    const without = await prepareCarouselTemplate(source, creators[0].id, false, loader);
    expect(loader).not.toHaveBeenCalled(); expect(without.slides[0].image).toBe('');
    const withImage = await prepareCarouselTemplate(source, creators[0].id, true, loader);
    expect(loader).toHaveBeenCalledTimes(1);
    const restored = parseCarouselProject(serializeCarouselProject(withImage.slides, withImage.design));
    expect(restored.slides[0]).toMatchObject({ image: 'data:image/webp;base64,AA==', imageSource: 'ai-sample', imageFrame: 'cutout' });
    expect(source.slides[0].image).toBe('');
  });

  it('preserves the previous document on media failure and supports undo after a successful apply', async () => {
    const source = project();
    const before = JSON.stringify(source);
    await expect(prepareCarouselTemplate(source, creators[0].id, true, async () => { throw new Error('missing sample'); })).rejects.toThrow('missing sample');
    expect(JSON.stringify(source)).toBe(before);
    const next = await prepareCarouselTemplate(source, creators[0].id, false);
    let history = carouselHistoryReducer(createCarouselHistory(source), { type: 'change', time: 0, update: () => next });
    history = carouselHistoryReducer(history, { type: 'undo' });
    expect(history.present).toEqual(source);
  });
});
