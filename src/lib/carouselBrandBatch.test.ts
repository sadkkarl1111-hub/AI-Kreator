import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAROUSEL_BACKGROUNDS, CAROUSEL_THEMES, carouselBrandPlacement, defaultCarouselDesign, initialCarouselSlides } from './carouselDesign';
import { parseCarouselProject, serializeCarouselProject } from './carouselProject';
import { batchImageDimensions, batchMime, batchOutputName, watermarkRect } from './batchImages';

beforeEach(() => { let id = 0; vi.stubGlobal('crypto', { randomUUID: () => `new-${id++}` }); });
afterEach(() => vi.unstubAllGlobals());
const slides = initialCarouselSlides.map((slide, index) => ({ ...slide, id: `original-${index}` }));
const data = 'data:image/png;base64,AA==';
describe('carousel branding and project files', () => {
  it('fits horizontal and vertical logos without cropping and supports replacement of the brand text', () => {
    const design = { ...defaultCarouselDesign, logo: data, brandMode: 'logo' as const, logoSize: 90 };
    const horizontal = carouselBrandPlacement(design, 1000, 100);
    expect(horizontal.width).toBe(220); expect(horizontal.height).toBe(22); expect(horizontal.showText).toBe(false);
    const vertical = carouselBrandPlacement(design, 100, 1000);
    expect(vertical.height).toBe(90); expect(vertical.width).toBe(9);
    expect(carouselBrandPlacement({ ...design, brandMode: 'both' }, 400, 200).showText).toBe(true);
    expect(carouselBrandPlacement({ ...design, brandMode: 'text' }, 400, 200).showLogo).toBe(false);
    expect(carouselBrandPlacement({ ...design, logo: '' }, 0, 0).showText).toBe(true);
  });
  it('round-trips logo, photos, text, ordering and presentation options while regenerating local slide identities', () => {
    const design = { ...defaultCarouselDesign, theme: 'newspaper', logo: data, background: 'photo', backgroundImage: data, backgroundShield: 0, brandMode: 'logo' as const };
    const project = parseCarouselProject(serializeCarouselProject([{ ...slides[0], image: data }, slides[1]], design));
    expect(project.design).toEqual(design);
    expect(project.slides.map(slide => slide.title)).toEqual(slides.slice(0, 2).map(slide => slide.title));
    expect(project.slides[0].image).toBe(data);
    expect(project.slides[0].id).not.toBe(slides[0].id);
    expect(new Set(project.slides.map(slide => slide.id)).size).toBe(2);
  });
  it('rejects remote images, executable payloads, unknown choices, missing data and excessive slide counts', () => {
    const project = { version: 1, slides, design: defaultCarouselDesign };
    for (const design of [
      { ...defaultCarouselDesign, logo: 'https://example.com/logo.png' },
      { ...defaultCarouselDesign, backgroundImage: 'data:image/svg+xml,<svg onload="alert(1)"/>' },
      { ...defaultCarouselDesign, theme: 'unknown' }, { ...defaultCarouselDesign, accent: 'url(x)' },
      { ...defaultCarouselDesign, brandMode: 'unknown' },
    ]) expect(() => parseCarouselProject(JSON.stringify({ ...project, design }))).toThrow();
    for (const broken of [{}, { ...project, version: 9 }, { ...project, slides: [] }, { ...project, slides: Array(11).fill(slides[0]) }, { ...project, slides: [{ ...slides[0], title: 'x'.repeat(101) }] }]) expect(() => parseCarouselProject(JSON.stringify(broken))).toThrow();
    expect(() => parseCarouselProject('not JSON')).toThrow();
  });
  it('has unique, selectable theme and background identifiers including newspaper and 3D', () => {
    expect(CAROUSEL_THEMES).toHaveLength(16); expect(new Set(CAROUSEL_THEMES.map(item => item.id)).size).toBe(16);
    expect(CAROUSEL_BACKGROUNDS.map(item => item.id)).toContain('depth');
    expect(CAROUSEL_BACKGROUNDS.map(item => item.id)).toContain('paper');
  });
});
describe('batch output geometry and naming', () => {
  it('resizes the longest edge without stretching, enlarging small images or allocating unbounded canvases', () => {
    expect(batchImageDimensions(4000, 1000, 1920)).toEqual({ width: 1920, height: 480 });
    expect(batchImageDimensions(1000, 4000, 1080)).toEqual({ width: 270, height: 1080 });
    expect(batchImageDimensions(20, 10, 1080)).toEqual({ width: 20, height: 10 });
    expect(() => batchImageDimensions(6000, 6000, 0)).toThrow();
    expect(() => batchImageDimensions(10000, 10000, 1080)).toThrow();
  });
  it('creates distinct safe ZIP entries for duplicate names and uses the actual selected extension', () => {
    const first = batchOutputName('../../Moje logo?.png', 0, 'jpeg'), second = batchOutputName('../../Moje logo?.png', 1, 'jpeg');
    expect(first).not.toBe(second); expect(first).toMatch(/^01-.*\.jpg$/); expect(first).not.toMatch(/\.\.|[/\\]/);
    expect(batchOutputName('Żółć.webp', 2, 'png')).toBe('03-Żółć.png');
    expect(batchMime('webp')).toBe('image/webp');
  });
  it('keeps watermarks within each image at all offered positions', () => {
    for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] as const) {
      const rect = watermarkRect(500, 300, 100, 60, position);
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + 100).toBeLessThanOrEqual(500); expect(rect.y + 60).toBeLessThanOrEqual(300);
    }
  });
});
