import { expect, it } from 'vitest';
import { applyWordStyle, drawRichText, layoutRichText, textStyleMap, validateTextMarks, wrapRichText } from './carouselRichText';
import { carouselTextHit, carouselWordAtPoint, clampTextCenter, validateCarouselTextFrames, type CarouselTextBox } from './carouselTextGeometry';
import { parseCarouselProject, serializeCarouselProject } from './carouselProject';
import { defaultCarouselDesign, initialCarouselSlides } from './carouselDesign';
const measure = (text: string, size: number) => Array.from(text).length * size * .5;

it('enlarges only the marked word and measures its real width and line height', () => {
  const lines = wrapRichText('Mały DUŻY tekst', [{ start: 5, end: 9, size: 200 }], 1000, 20, measure);
  expect(lines[0].runs.find(run => run.text === 'DUŻY')?.width).toBe(80);
  expect(lines[0].runs.find(run => run.text === 'Mały')?.width).toBe(40);
  expect(lines[0].height).toBe(52);
  const wrapped = wrapRichText('Mały DUŻY tekst', [{ start: 5, end: 9, size: 200 }], 100, 20, measure);
  expect(wrapped).toHaveLength(3); expect(wrapped.every(line => line.width <= 100)).toBe(true);
});
it('accounts for varied word sizes separately in both newspaper columns', () => {
  expect(layoutRichText('a\nb\nc\nd', [], 200, 52, 20, 20, measure, 2).fits).toBe(true);
  const large = layoutRichText('a\nb\nc\nd', [{ start: 0, end: 1, size: 200 }], 200, 52, 20, 20, measure, 2);
  expect(large.fits).toBe(false); expect(large.usedHeight).toBe(78);
  expect(layoutRichText('abc', [], 1000, 16 * 1.3, 23, 16, measure).fits).toBe(true);
});
it('reserves space for thick double underlines and padded word backgrounds', () => {
  const lines = wrapRichText('Ważne\ndalej', [{ start: 0, end: 5, underline: true, underlineStyle: 'double', underlineWidth: 12, highlight: '#ffff00', highlightPadding: 24 }], 1000, 20, measure);
  expect(lines[0].height).toBeGreaterThan(75); expect(lines[0].inset).toBe(24); expect(lines[1].height).toBe(26);
});
it('retains actual UTF-16 indices when splitting a long word', () => {
  const lines = wrapRichText('A🦊BCDE', [], 20, 20, measure);
  expect(lines.flatMap(line => line.runs).map(run => run.start)).toEqual([0,1,3,4,5,6]);
});
it('removes the marker without clearing font size, color or underline', () => {
  const marks = applyWordStyle('Ważne', [], 0, 5, { size: 175, color: '#123456', underline: true, highlight: '#fedcba', highlightRadius: 12 });
  const clear = applyWordStyle('Ważne', marks, 0, 5, { highlight: undefined, highlightRadius: undefined });
  expect(clear).toEqual([{ start: 0, end: 5, size: 175, color: '#123456', underline: true }]);
  expect(textStyleMap('Ważne', clear)[1].highlight).toBeUndefined();
});
it('rejects unsafe or nonfinite effects, frames and oversized imported word scales', () => {
  for (const style of [{ size: 301 }, { size: NaN }, { highlightPadding: 25 }, { highlightOpacity: -1 }, { highlightRadius: Infinity }, { underlineStyle: 'script' }, { underlineColor: 'url(x)' }, { underlineWidth: 0 }]) expect(() => validateTextMarks([{ start: 0, end: 1, ...style }], 'abc')).toThrow();
  for (const frame of [{ x: -1 }, { rotation: 181 }, { width: 9 }, { scale: 251 }, { y: NaN }, { opacity: 101 }, { fill: 'url(x)' }, { align: 'script' }]) expect(() => validateCarouselTextFrames({ title: frame })).toThrow();
  expect(() => validateCarouselTextFrames({ external: {} })).toThrow();
});
it('hit tests a rotated non-square text box and selects the whole word in the rotated coordinates', () => {
  const box: CarouselTextBox = { field: 'title', x: 500, y: 500, width: 300, height: 60, rotation: 90, fontSize: 20, runs: [{ start: 0, end: 3, x: -150, y: -30, width: 45, height: 24 }] };
  expect(carouselTextHit(box, 500, 380)).toBe(true); expect(carouselTextHit(box, 600, 500)).toBe(false);
  expect(carouselWordAtPoint('Hej świecie', box, 520, 365)).toEqual({ start: 0, end: 3 });
  expect(carouselWordAtPoint('Hej świecie', box, 900, 900)).toBeNull();
  const clamped = clampTextCenter(box, -500, 5000, 1080, 1350); expect(clamped.x).toBeCloseTo(34); expect(clamped.y).toBe(1196);
});
it('round-trips transformed text and detailed effects while reading legacy projects', () => {
  const titleMarks = [{ start: 0, end: 3, size: 180, underline: true, underlineStyle: 'wavy' as const, underlineColor: '#123456', underlineWidth: 8, highlight: '#fedcba', highlightRadius: 18, highlightPadding: 12, highlightOpacity: 65 }];
  const textFrames = { title: { x: 50, y: 45, width: 60, rotation: 25, scale: 130, fill: '#123456', radius: 20, padding: 18, opacity: 80, align: 'center' as const }, body: { rotation: -15 } };
  const slide = { ...initialCarouselSlides[0], id: 'slide', textFrames, titleMarks, kickerMarks: [{ start: 0, end: 3, size: 125 }] };
  const saved = parseCarouselProject(serializeCarouselProject([slide], defaultCarouselDesign)).slides[0];
  expect(saved.textFrames).toEqual(textFrames); expect(saved.titleMarks).toEqual(titleMarks); expect(saved.kickerMarks).toEqual(slide.kickerMarks);
  const legacy = parseCarouselProject(serializeCarouselProject([{ ...initialCarouselSlides[0], id: 'old' }], defaultCarouselDesign));
  expect(legacy.slides[0].textFrames).toBeUndefined();
});
it('draws different font sizes and transformed backgrounds and returns local word targets', () => {
  const fonts: string[] = [], backgrounds: number[][] = [];
  const context = { font: '', fillStyle: '#fff', lineWidth: 1, save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, setLineDash() {}, stroke() {}, moveTo() {}, lineTo() {}, fill() {}, roundRect(...values: number[]) { backgrounds.push(values); }, measureText(text: string) { return { width: measure(text, Number(this.font.match(/([\d.]+)px/)?.[1]) || 20) }; }, fillText() { fonts.push(this.font); } } as unknown as CanvasRenderingContext2D;
  const result = drawRichText(context, 'Hej DUŻY', [{ start: 4, end: 8, size: 200, underline: true, underlineStyle: 'double', highlight: '#ffff00', highlightRadius: 8 }], 80, 250, 500, 300, 20, 20, 'Arial', false, '#ffffff', 1, 54, { x: 50, y: 50, width: 50, rotation: 30, fill: '#123456', padding: 14, radius: 18 }, { width: 1080, height: 1350 });
  expect(fonts.some(font => font.includes('40px'))).toBe(true); expect(fonts.some(font => font.includes('20px'))).toBe(true);
  expect(result.bounds).toMatchObject({ x: 540, y: 675, width: 500, rotation: 30 }); expect(backgrounds).toHaveLength(2);
  expect(result.hits.find(hit => hit.start === 4)?.height).toBe(48);
});
