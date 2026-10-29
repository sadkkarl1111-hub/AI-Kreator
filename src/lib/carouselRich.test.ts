import { describe, expect, it } from 'vitest';
import { applyWordStyle, layoutRichText, textStyleMap, updateTextMarks, validateTextMarks, wrapRichText } from './carouselRichText';
import { CAROUSEL_STICKERS, moveSticker, stickerHit, stickerTransform, validateStickers, type SlideSticker } from './carouselStickers';
import { defaultCarouselDesign, initialCarouselSlides } from './carouselDesign';
import { parseCarouselProject, serializeCarouselProject } from './carouselProject';

const measure = (text: string, size: number, style: { bold?: boolean }) => Array.from(text).length * size * (style.bold ? .7 : .5);
const sticker: SlideSticker = { id: 'one', kind: 'star', x: 50, y: 50, size: 20, rotation: 45, color: '#aa44ff', motion: 'pulse' };
describe('selected word styles', () => {
  it('combines overlapping styles and clears only the selection', () => {
    const text = 'Ważne słowa tutaj';
    const colored = applyWordStyle(text, [], 0, 11, { color: '#ff0000' });
    const marks = applyWordStyle(text, colored, 6, 16, { underline: true, bold: true });
    const styles = textStyleMap(text, marks);
    expect(styles[7]).toEqual({ color: '#ff0000', underline: true, bold: true });
    expect(styles[14]).toEqual({ underline: true, bold: true });
    const cleared = textStyleMap(text, applyWordStyle(text, marks, 6, 11, null));
    expect(cleared[6]).toEqual({}); expect(cleared[0].color).toBe('#ff0000'); expect(cleared[14].bold).toBe(true);
  });
  it('moves formatting with inserted/deleted text and resets fully replaced content', () => {
    const marks = [{ start: 6, end: 11, color: '#ff0000' }];
    expect(updateTextMarks('Ważne słowa', 'Hej Ważne słowa', marks)).toEqual([{ start: 10, end: 15, color: '#ff0000' }]);
    expect(updateTextMarks('Ważne słowa', 'słowa', marks)).toEqual([{ start: 0, end: 5, color: '#ff0000' }]);
    expect(updateTextMarks('Ważne słowa', 'ABC', marks)).toEqual([]);
    expect(updateTextMarks('słowa', 'słoXXwa', [{ start: 0, end: 5, bold: true }])).toEqual([{ start: 0, end: 7, bold: true }]);
  });
  it('wraps mixed formatting without losing Polish letters or emoji and respects explicit lines', () => {
    const text = 'Żółw 🦊\nważne słowa';
    const lines = wrapRichText(text, [{ start: 0, end: 4, bold: true }], 70, 20, measure);
    expect(lines.flatMap(line => line.runs.map(run => run.text)).join('').replace(/ /g, '')).toBe('Żółw🦊ważnesłowa');
    expect(lines.every(line => line.width <= 70)).toBe(true);
    expect(wrapRichText('A\n\nB', [], 100, 20, measure)).toHaveLength(3);
  });
  it('accounts for bold font width and newspaper columns when fitting', () => {
    const plain = layoutRichText('abc abc abc abc', [], 100, 80, 30, 10, measure);
    const bold = layoutRichText('abc abc abc abc', [{ start: 0, end: 15, bold: true }], 100, 80, 30, 10, measure);
    expect(bold.size).toBeLessThanOrEqual(plain.size);
    expect(layoutRichText('a\nb\nc\nd', [], 100, 52, 20, 20, measure, 2).fits).toBe(true);
    expect(layoutRichText('a\nb\nc\nd', [], 100, 52, 20, 20, measure).fits).toBe(false);
  });
  it('rejects unsafe colors, invalid ranges and unknown fonts in imported projects', () => {
    for (const mark of [{ start: -1, end: 3 }, { start: 0, end: 30 }, { start: 0, end: 1, color: 'url(x)' }, { start: 0, end: 1, font: 'bad' }]) expect(() => validateTextMarks([mark], 'abc')).toThrow();
  });
});
describe('carousel sticker geometry and projects', () => {
  it('contains 48 unique stickers and keeps dragged centers inside the slide', () => {
    expect(new Set(CAROUSEL_STICKERS.map(item => item.id)).size).toBe(48);
    expect(moveSticker(sticker, -10, 150)).toMatchObject({ x: 0, y: 100 });
    expect(stickerHit(sticker, 500, 500, 1000, 1000)).toBe(true);
    expect(stickerHit(sticker, 640, 640, 1000, 1000)).toBe(false);
  });
  it('loops animated transforms and leaves static transforms fixed', () => {
    for (const motion of ['pulse', 'bounce', 'wiggle', 'spin'] as const) {
      const first = stickerTransform({ ...sticker, motion }, 0), quarter = stickerTransform({ ...sticker, motion }, 400), end = stickerTransform({ ...sticker, motion }, 1600);
      expect(first).not.toEqual(quarter); expect(first.scale).toBeCloseTo(end.scale); expect(first.dy).toBeCloseTo(end.dy);
    }
    expect(stickerTransform({ ...sticker, motion: 'none' }, 400)).toEqual(stickerTransform({ ...sticker, motion: 'none' }, 0));
  });
  it('rejects unknown art, too many stickers and invalid geometry', () => {
    for (const value of [[{ ...sticker, size: 100 }], [{ ...sticker, x: -1 }], [{ ...sticker, motion: 'bad' }], [{ ...sticker, kind: 'external' }], [sticker, sticker], Array.from({length:17}, (_,index) => ({...sticker,id:`element-${index}`}))]) expect(() => validateStickers(value)).toThrow();
  });
  it('round-trips stickers and word formatting and supports projects without these properties', () => {
    const slide = { ...initialCarouselSlides[0], id: 'first', stickers: [sticker], titleMarks: [{ start: 0, end: 3, underline: true, color: '#aa44ff' }] };
    const result = parseCarouselProject(serializeCarouselProject([slide], { ...defaultCarouselDesign, titleFont: 'georgia', bodyScale: 120 }));
    expect(result.slides[0].stickers).toEqual([sticker]); expect(result.slides[0].titleMarks).toEqual(slide.titleMarks);
    expect(result.design.titleFont).toBe('georgia'); expect(result.design.bodyScale).toBe(120);
    const legacy = parseCarouselProject(serializeCarouselProject([{ ...initialCarouselSlides[0], id: 'first' }], defaultCarouselDesign));
    expect(legacy.slides[0].stickers).toEqual([]); expect(legacy.slides[0].titleMarks).toEqual([]);
  });
});
