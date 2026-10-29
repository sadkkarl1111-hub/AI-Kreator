export const CAROUSEL_NUMBER_STYLES = [
  { id: 'fraction', label: '01 / 08' }, { id: 'words', label: '1 z 8' }, { id: 'plain', label: '01' },
  { id: 'dots', label: 'Kropki' }, { id: 'bar', label: 'Pasek postępu' }, { id: 'segments', label: 'Segmenty' }, { id: 'none', label: 'Bez numeracji' },
] as const;
export const CAROUSEL_ARROW_STYLES = [
  { id: 'simple', label: 'Prosta →' }, { id: 'double', label: 'Podwójna »' }, { id: 'hand', label: 'Odręczna' },
  { id: 'circle', label: 'W kółku' }, { id: 'pill', label: 'Na kapsułce' }, { id: 'none', label: 'Bez strzałki' },
] as const;
export type CarouselNavigation = {
  numberStyle: typeof CAROUSEL_NUMBER_STYLES[number]['id']; numberX: number; numberY: number; numberSize: number; numberColor?: string;
  numberHideFirst: boolean; numberHideLast: boolean;
  arrowStyle: typeof CAROUSEL_ARROW_STYLES[number]['id']; arrowX: number; arrowY: number; arrowSize: number; arrowColor?: string;
  arrowHideFirst: boolean; arrowHideLast: boolean; caption: string; captionVisible: boolean; footerLine: boolean;
};
export const defaultCarouselNavigation: CarouselNavigation = {
  numberStyle: 'fraction', numberX: 91, numberY: 6, numberSize: 26, numberHideFirst: false, numberHideLast: false,
  arrowStyle: 'simple', arrowX: 91, arrowY: 95, arrowSize: 40, arrowHideFirst: false, arrowHideLast: true,
  caption: 'Przesuń dalej', captionVisible: true, footerLine: true,
};
export function validateCarouselNavigation(value: unknown): CarouselNavigation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Niepoprawna nawigacja karuzeli.');
  const raw = value as Record<string, unknown>, result = { ...defaultCarouselNavigation };
  for (const [key, choices] of [['numberStyle', CAROUSEL_NUMBER_STYLES], ['arrowStyle', CAROUSEL_ARROW_STYLES]] as const) {
    if (!choices.some(item => item.id === raw[key])) throw new Error('Niepoprawny styl nawigacji.');
  }
  result.numberStyle = raw.numberStyle as CarouselNavigation['numberStyle']; result.arrowStyle = raw.arrowStyle as CarouselNavigation['arrowStyle'];
  const ranges = { numberX: [5, 95], numberY: [4, 96], arrowX: [5, 95], arrowY: [4, 96], numberSize: [18, 60], arrowSize: [24, 100] } as const;
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const v = raw[key]; if (typeof v !== 'number' || !Number.isFinite(v) || v < ranges[key][0] || v > ranges[key][1]) throw new Error('Niepoprawne położenie lub rozmiar nawigacji.'); result[key] = v;
  }
  for (const key of ['numberHideFirst', 'numberHideLast', 'arrowHideFirst', 'arrowHideLast', 'captionVisible', 'footerLine'] as const) {
    if (typeof raw[key] !== 'boolean') throw new Error('Niepoprawna widoczność nawigacji.'); result[key] = raw[key];
  }
  for (const key of ['numberColor', 'arrowColor'] as const) if (raw[key] !== undefined) {
    if (typeof raw[key] !== 'string' || !/^#[\da-f]{6}$/i.test(raw[key])) throw new Error('Niepoprawny kolor nawigacji.'); result[key] = raw[key];
  }
  if (typeof raw.caption !== 'string' || raw.caption.length > 40) throw new Error('Podpis strzałki może mieć do 40 znaków.'); result.caption = raw.caption;
  return result;
}
export const navigationVisible = (hideFirst: boolean, hideLast: boolean, index: number, count: number) => !(hideFirst && index === 0) && !(hideLast && index === count - 1);
export const carouselPageLabel = (style: CarouselNavigation['numberStyle'], index: number, count: number) => style === 'words' ? `${index + 1} z ${count}` : style === 'plain' ? String(index + 1).padStart(2, '0') : `${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
const fitCenter = (value: number, half: number, limit: number) => Math.max(half + 26, Math.min(limit - half - 26, value));
export function drawCarouselNavigation(context: CanvasRenderingContext2D, nav: CarouselNavigation, index: number, count: number, width: number, height: number, muted: string, accent: string) {
  context.save(); context.textBaseline = 'middle';
  if (nav.numberStyle !== 'none' && navigationVisible(nav.numberHideFirst, nav.numberHideLast, index, count)) {
    context.fillStyle = nav.numberColor || muted; context.strokeStyle = context.fillStyle;
    context.font = `600 ${nav.numberSize}px Arial`; context.textAlign = 'center';
    const visual = ['dots', 'bar', 'segments'].includes(nav.numberStyle);
    const groupWidth = nav.numberStyle === 'dots' ? count * nav.numberSize * .85 : visual ? Math.max(160, nav.numberSize * 6) : context.measureText(carouselPageLabel(nav.numberStyle, index, count)).width;
    const x = fitCenter(width * nav.numberX / 100, groupWidth / 2, width), y = height * nav.numberY / 100;
    if (nav.numberStyle === 'dots') {
      for (let i = 0; i < count; i++) { context.globalAlpha = i === index ? 1 : .25; context.beginPath(); context.arc(x - groupWidth / 2 + (i + .5) * nav.numberSize * .85, y, nav.numberSize * (i === index ? .21 : .15), 0, Math.PI * 2); context.fill(); }
    } else if (nav.numberStyle === 'bar' || nav.numberStyle === 'segments') {
      const parts = nav.numberStyle === 'segments' ? count : 1, gap = parts > 1 ? 6 : 0, partWidth = (groupWidth - gap * (parts - 1)) / parts, h = Math.max(5, nav.numberSize * .22);
      for (let i = 0; i < parts; i++) { context.globalAlpha = .22; context.beginPath(); context.roundRect(x - groupWidth / 2 + i * (partWidth + gap), y - h / 2, partWidth, h, h / 2); context.fill(); }
      context.globalAlpha = 1;
      for (let i = 0; i < (parts === 1 ? 1 : index + 1); i++) { context.beginPath(); context.roundRect(x - groupWidth / 2 + i * (partWidth + gap), y - h / 2, parts === 1 ? groupWidth * (index + 1) / count : partWidth, h, h / 2); context.fill(); }
    } else context.fillText(carouselPageLabel(nav.numberStyle, index, count), x, y);
  }
  context.globalAlpha = 1;
  if (nav.footerLine) { context.fillStyle = accent; context.fillRect(82, height - 105, width - 164, 3); }
  if (navigationVisible(nav.arrowHideFirst, nav.arrowHideLast, index, count)) {
    const color = nav.arrowColor || accent, s = nav.arrowSize, radius = s * (nav.arrowStyle === 'pill' ? 1 : .75);
    const x = fitCenter(width * nav.arrowX / 100, radius, width), y = fitCenter(height * nav.arrowY / 100, s * .75, height);
    context.strokeStyle = color; context.fillStyle = color; context.lineWidth = Math.max(3, s / 12); context.lineCap = 'round'; context.lineJoin = 'round';
    if (nav.arrowStyle === 'circle' || nav.arrowStyle === 'pill') { context.save(); context.globalAlpha = .16; context.beginPath(); context.roundRect(x - s * (nav.arrowStyle === 'pill' ? 1 : .75), y - s * .75, s * (nav.arrowStyle === 'pill' ? 2 : 1.5), s * 1.5, s * .75); context.fill(); context.restore(); }
    if (nav.arrowStyle !== 'none') {
      context.beginPath();
      if (nav.arrowStyle === 'double') { for (const dx of [-s * .25, s * .2]) { context.moveTo(x + dx - s * .2, y - s * .3); context.lineTo(x + dx + s * .15, y); context.lineTo(x + dx - s * .2, y + s * .3); } }
      else { context.moveTo(x - s * .5, y); if (nav.arrowStyle === 'hand') context.bezierCurveTo(x - s * .2, y - s * .3, x + s * .1, y + s * .22, x + s * .5, y); else context.lineTo(x + s * .5, y); context.moveTo(x + s * .18, y - s * .32); context.lineTo(x + s * .5, y); context.lineTo(x + s * .18, y + s * .32); }
      context.stroke();
    }
    if (nav.captionVisible && nav.caption) { context.fillStyle = nav.arrowColor || muted; let fontSize = 24; const left = nav.arrowStyle === 'none' || x >= width / 2 ? 82 : x + radius + 30; const available = nav.arrowStyle === 'none' ? width - 164 : Math.max(80, x >= width / 2 ? x - radius - 110 : width - left - 82); do { context.font = `500 ${fontSize}px Arial`; if (context.measureText(nav.caption).width <= available) break; fontSize--; } while (fontSize > 14); context.textAlign = 'left'; context.fillText(nav.caption, left, y, available); }
  }
  context.restore();
}
