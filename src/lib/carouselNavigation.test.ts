import { expect, it } from 'vitest';
import { carouselPageLabel, defaultCarouselNavigation, drawCarouselNavigation, navigationVisible, validateCarouselNavigation, CAROUSEL_NUMBER_STYLES, CAROUSEL_ARROW_STYLES } from './carouselNavigation';
import { applyCarouselComposition, applyCarouselCta, validateCarouselCta, CAROUSEL_COMPOSITIONS } from './carouselConversion';
import { defaultCarouselDesign, initialCarouselSlides } from './carouselDesign';
import { parseCarouselProject, serializeCarouselProject } from './carouselProject';
import { createCarouselHistory, carouselHistoryReducer } from './carouselHistory';
const slide = { ...initialCarouselSlides[0], id: 'first', image: 'data:image/png;base64,AA==', titleMarks: [{ start: 0, end: 3, size: 150 }], textFrames: { title: { x: 40, y: 30, rotation: 15 } } };
function painter() {
  const labels: string[] = [], circles: number[][] = [], rects: number[][] = [];
  let strokes = 0;
  const context = { font: '', save() {}, restore() {}, measureText: (value: string) => ({ width: value.length * 14 }), fillText: (value: string) => labels.push(value), fillRect: (...args: number[]) => rects.push(args), roundRect: (...args: number[]) => rects.push(args), arc: (...args: number[]) => circles.push(args), beginPath() {}, fill() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, stroke() { strokes++; } } as unknown as CanvasRenderingContext2D;
  return { context, labels, circles, rects, strokes: () => strokes };
}
it('numbers slides from their current index and count, including after reordering', () => {
  expect(carouselPageLabel('fraction', 0, 8)).toBe('01 / 08'); expect(carouselPageLabel('words', 7, 8)).toBe('8 z 8'); expect(carouselPageLabel('plain', 9, 10)).toBe('10');
  expect(navigationVisible(true, true, 0, 5)).toBe(false); expect(navigationVisible(true, true, 4, 5)).toBe(false); expect(navigationVisible(true, true, 2, 5)).toBe(true); expect(navigationVisible(false, true, 0, 1)).toBe(false);
});
it('draws each numbering/progress and arrow style without adding a page label to progress graphics', () => {
  for (const numberStyle of CAROUSEL_NUMBER_STYLES.map(item => item.id)) {
    const p = painter(); drawCarouselNavigation(p.context, { ...defaultCarouselNavigation, numberStyle, arrowStyle: 'none', captionVisible: false, footerLine: false }, 2, 5, 1080, 1350, '#aaaaaa','#ff8800');
    if (['fraction','words','plain'].includes(numberStyle)) expect(p.labels).toEqual([carouselPageLabel(numberStyle,2,5)]); else expect(p.labels).toEqual([]);
    if (numberStyle === 'dots') expect(p.circles).toHaveLength(5);
    if (numberStyle === 'bar') expect(p.rects).toHaveLength(2);
    if (numberStyle === 'segments') expect(p.rects).toHaveLength(8);
  }
  for (const arrowStyle of CAROUSEL_ARROW_STYLES.map(item => item.id)) {
    const p = painter(); drawCarouselNavigation(p.context, { ...defaultCarouselNavigation, numberStyle: 'none', arrowStyle, footerLine: false }, 0, 5, 1080,1080,'#aaaaaa','#ff8800');
    expect(p.strokes()).toBe(arrowStyle === 'none' ? 0 : 1); expect(p.labels).toEqual(['Przesuń dalej']);
  }
});
it('hides numbering and arrows independently on first and last, retaining a configurable footer line', () => {
  const p = painter(), nav = { ...defaultCarouselNavigation, numberHideFirst: true, numberHideLast: true, arrowHideFirst: true };
  drawCarouselNavigation(p.context, nav,0,5,1080,1350,'#aaaaaa','#ff8800'); expect(p.labels).toEqual([]); expect(p.strokes()).toBe(0); expect(p.rects).toHaveLength(1);
  const last = painter(); drawCarouselNavigation(last.context, { ...nav, footerLine: false },4,5,1080,1350,'#aaaaaa','#ff8800'); expect(last.labels).toEqual([]); expect(last.rects).toHaveLength(0);
});
it('validates all navigation values and rejects unsafe styles, colors, coordinates and captions', () => {
  expect(validateCarouselNavigation(defaultCarouselNavigation)).toEqual(defaultCarouselNavigation);
  for (const patch of [{numberStyle:'bad'},{arrowStyle:'bad'},{numberX:0},{arrowY:Infinity},{numberSize:NaN},{arrowSize:101},{numberHideFirst:'true'},{caption:'x'.repeat(41)},{numberColor:'url(x)'},{arrowColor:'#fff'}]) expect(() => validateCarouselNavigation({...defaultCarouselNavigation,...patch})).toThrow();
});
it('round-trips navigation, per-slide layouts and CTA while supporting old projects', () => {
  const cta = { text: 'Sprawdź ofertę w bio', style: 'outline' as const, color: '#123456' }, nav = { ...defaultCarouselNavigation, numberStyle: 'segments' as const, arrowStyle: 'hand' as const, caption: 'Zobacz kolejny krok', numberHideFirst: true };
  const saved = parseCarouselProject(serializeCarouselProject([{...slide,composition:'ending-card',cta}],{...defaultCarouselDesign,navigation:nav}));
  expect(saved.design.navigation).toEqual(nav); expect(saved.slides[0].cta).toEqual(cta); expect(saved.slides[0].composition).toBe('ending-card');
  const legacy = parseCarouselProject(serializeCarouselProject([slide],defaultCarouselDesign)); expect(legacy.design.navigation).toBeUndefined(); expect(legacy.slides[0].composition).toBeUndefined();
  for (const bad of [{...cta,text:'x'.repeat(37)},{...cta,style:'link'},{...cta,color:'url(x)'}]) expect(() => validateCarouselCta(bad)).toThrow();
  expect(() => parseCarouselProject(serializeCarouselProject([{...slide,composition:'external' as 'cover-bold'}],defaultCarouselDesign))).toThrow();
});
it('applies a composition to one slide, preserving copy, media and word marks, then restores it with undo', () => {
  for (const preset of CAROUSEL_COMPOSITIONS) { const changed = applyCarouselComposition(slide,preset.id); expect(changed.title).toBe(slide.title); expect(changed.image).toBe(slide.image); expect(changed.titleMarks).toBe(slide.titleMarks); expect(changed.textFrames).toEqual({}); }
  const project = { slides:[slide,{...slide,id:'second'}],design:defaultCarouselDesign };
  let history = createCarouselHistory(project);
  history = carouselHistoryReducer(history,{type:'change',time:1,update:doc=>({...doc,slides:doc.slides.map((item,index)=>index===1?applyCarouselCta(item,'offer'):item)})});
  expect(history.present.slides[0]).toBe(slide); expect(history.present.slides[1].cta?.text).toBe('Sprawdź ofertę w bio');
  expect(history.present.slides[1].titleMarks).toEqual([]); expect(history.present.slides[1].image).toBe(slide.image);
  expect(carouselHistoryReducer(history,{type:'undo'}).present).toBe(project);
});
