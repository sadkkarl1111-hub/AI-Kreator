export const CAROUSEL_TEXT_FIELDS = ['kicker', 'title', 'body'] as const;
export type CarouselTextField = typeof CAROUSEL_TEXT_FIELDS[number];
export const CAROUSEL_TEXT_LABELS = { kicker: 'Etykieta', title: 'Nagłówek', body: 'Treść slajdu' };
export type CarouselTextFrame = {
  x?: number; y?: number; width?: number; scale?: number; rotation?: number;
  align?: 'left' | 'center' | 'right'; fill?: string; opacity?: number; padding?: number; radius?: number;
};
export type TextHitRun = { start: number; end: number; x: number; y: number; width: number; height: number };
export type CarouselTextBounds = { x: number; y: number; width: number; height: number; rotation: number };
export type CarouselTextBox = CarouselTextBounds & { field: CarouselTextField; runs: TextHitRun[]; fontSize: number };

export function validateCarouselTextFrames(value: unknown): Partial<Record<CarouselTextField, CarouselTextFrame>> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !CAROUSEL_TEXT_FIELDS.includes(key as CarouselTextField))) throw new Error('Niepoprawne pola tekstowe.');
  const frames: Partial<Record<CarouselTextField, CarouselTextFrame>> = {};
  for (const field of CAROUSEL_TEXT_FIELDS) {
    const raw = (value as Record<string, unknown>)[field]; if (raw === undefined) continue;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Niepoprawne pole tekstowe.');
    const frame: CarouselTextFrame = {};
    const ranges = { x: [0, 100], y: [0, 100], width: [10, 95], scale: [50, 250], rotation: [-180, 180], opacity: [0, 100], padding: [0, 60], radius: [0, 80] } as const;
    for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
      const val = (raw as Record<string, unknown>)[key]; if (val === undefined) continue;
      if (typeof val !== 'number' || !Number.isFinite(val) || val < ranges[key][0] || val > ranges[key][1]) throw new Error('Niepoprawna pozycja lub wygląd napisu.');
      frame[key] = val;
    }
    const { align, fill } = raw as Record<string, unknown>;
    if (align !== undefined) { if (!['left', 'center', 'right'].includes(String(align))) throw new Error('Niepoprawne wyrównanie tekstu.'); frame.align = align as CarouselTextFrame['align']; }
    if (fill !== undefined) { if (typeof fill !== 'string' || !/^#[\da-f]{6}$/i.test(fill)) throw new Error('Niepoprawne tło napisu.'); frame.fill = fill; }
    frames[field] = frame;
  }
  return frames;
}
export function textLocalPoint(box: CarouselTextBounds, x: number, y: number) {
  const angle = -box.rotation * Math.PI / 180, dx = x - box.x, dy = y - box.y;
  return { x: dx * Math.cos(angle) - dy * Math.sin(angle), y: dx * Math.sin(angle) + dy * Math.cos(angle) };
}
export function carouselTextHit(box: CarouselTextBounds, x: number, y: number) {
  const point = textLocalPoint(box, x, y);
  return Math.abs(point.x) <= box.width / 2 + 8 && Math.abs(point.y) <= box.height / 2 + 8;
}
export function clampTextCenter(box: Pick<CarouselTextBounds, 'width' | 'height' | 'rotation'>, x: number, y: number, width: number, height: number) {
  const angle = box.rotation * Math.PI / 180;
  const halfWidth = Math.min(width / 2, (Math.abs(box.width * Math.cos(angle)) + Math.abs(box.height * Math.sin(angle))) / 2 + 4);
  const halfHeight = Math.min(height / 2, (Math.abs(box.height * Math.cos(angle)) + Math.abs(box.width * Math.sin(angle))) / 2 + 4);
  return { x: Math.max(halfWidth, Math.min(width - halfWidth, x)), y: Math.max(halfHeight, Math.min(height - halfHeight, y)) };
}
export function carouselWordAtPoint(text: string, box: CarouselTextBox, x: number, y: number) {
  const point = textLocalPoint(box, x, y);
  const hit = box.runs.find(run => point.x >= run.x && point.x <= run.x + run.width && point.y >= run.y && point.y <= run.y + run.height);
  if (!hit) return null;
  for (const word of text.matchAll(/\S+/gu)) if (word.index! <= hit.start && word.index! + word[0].length > hit.start) return { start: word.index!, end: word.index! + word[0].length };
  return null;
}
