import { clampTextCenter, type CarouselTextFrame, type CarouselTextBounds, type TextHitRun } from './carouselTextGeometry';
export type WordStyle = { color?: string; highlight?: string; bold?: boolean; italic?: boolean; underline?: boolean; font?: string; size?: number; highlightPadding?: number; highlightRadius?: number; highlightOpacity?: number; underlineColor?: string; underlineWidth?: number; underlineStyle?: 'solid' | 'double' | 'dashed' | 'wavy' };
export type TextMark = WordStyle & { start: number; end: number };
export const CAROUSEL_FONTS = [
  { id: 'anton', name: 'Plakatowa · Anton', family: 'Anton' },
  { id: 'theme', name: 'Ze stylu', family: '' }, { id: 'arial', name: 'Klasyczna', family: 'Arial' },
  { id: 'georgia', name: 'Gazetowa', family: 'Georgia' }, { id: 'impact', name: 'Mocna', family: 'Impact' },
  { id: 'trebuchet', name: 'Nowoczesna', family: 'Trebuchet MS' }, { id: 'verdana', name: 'Czytelna', family: 'Verdana' },
  { id: 'courier', name: 'Maszynowa', family: 'Courier New' }, { id: 'palatino', name: 'Elegancka', family: 'Palatino Linotype' },
] as const;
export const carouselFont = (id: string | undefined, fallback: string) => CAROUSEL_FONTS.find(font => font.id === id)?.family || fallback;
const safeColor = (value: unknown) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);

export function validateTextMarks(value: unknown, text: string): TextMark[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 500) throw new Error('Niepoprawne formatowanie tekstu w projekcie.');
  return value.map(mark => {
    if (!mark || !Number.isInteger(mark.start) || !Number.isInteger(mark.end) || mark.start < 0 || mark.end <= mark.start || mark.end > text.length) throw new Error('Niepoprawny zakres wyróżnienia tekstu.');
    const result: TextMark = { start: mark.start, end: mark.end };
    for (const key of ['color', 'highlight', 'underlineColor'] as const) { if (mark[key] !== undefined) { if (!safeColor(mark[key])) throw new Error('Niepoprawny kolor tekstu.'); result[key] = mark[key]; } }
    for (const key of ['bold', 'underline', 'italic'] as const) { if (mark[key] !== undefined) { if (typeof mark[key] !== 'boolean') throw new Error('Niepoprawne formatowanie.'); result[key] = mark[key]; } }
    const limits = { size: [50, 300], highlightPadding: [0, 24], highlightRadius: [0, 32], highlightOpacity: [0, 100], underlineWidth: [1, 12] } as const;
    for (const key of Object.keys(limits) as (keyof typeof limits)[]) if (mark[key] !== undefined) {
      if (typeof mark[key] !== 'number' || !Number.isFinite(mark[key]) || mark[key] < limits[key][0] || mark[key] > limits[key][1]) throw new Error('Niepoprawny rozmiar lub efekt tekstu.'); result[key] = mark[key];
    }
    if (mark.underlineStyle !== undefined) { if (!['solid', 'double', 'dashed', 'wavy'].includes(mark.underlineStyle)) throw new Error('Niepoprawne podkreślenie.'); result.underlineStyle = mark.underlineStyle; }
    if (mark.font !== undefined) { if (!CAROUSEL_FONTS.some(font => font.id === mark.font)) throw new Error('Niepoprawna czcionka.'); result.font = mark.font; }
    return result;
  });
}
export function textStyleMap(text: string, marks: TextMark[] = []) {
  const styles: WordStyle[] = Array.from({ length: text.length }, () => ({}));
  for (const { start, end, ...style } of marks) for (let index = Math.max(0, start); index < Math.min(text.length, end); index++) styles[index] = { ...styles[index], ...style };
  return styles;
}
function compactMarks(styles: WordStyle[]): TextMark[] {
  const result: TextMark[] = []; let previous = '';
  styles.forEach((style, index) => {
    const key = JSON.stringify(style);
    if (key === previous && result.length && result[result.length - 1].end === index) result[result.length - 1].end++;
    else if (Object.keys(style).length) result.push({ start: index, end: index + 1, ...style });
    previous = key;
  });
  return result;
}
export function applyWordStyle(text: string, marks: TextMark[], start: number, end: number, patch: WordStyle | null) {
  const styles = textStyleMap(text, marks);
  for (let index = Math.max(0, start); index < Math.min(text.length, end); index++) {
    const next = patch ? { ...styles[index], ...patch } : {};
    for (const key of Object.keys(next) as (keyof WordStyle)[]) if (next[key] === undefined) delete next[key];
    styles[index] = next;
  }
  return compactMarks(styles);
}
export function updateTextMarks(previous: string, next: string, marks: TextMark[] = []) {
  let prefix = 0, suffix = 0;
  while (prefix < Math.min(previous.length, next.length) && previous[prefix] === next[prefix]) prefix++;
  while (suffix < previous.length - prefix && suffix < next.length - prefix && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
  const styles = textStyleMap(previous, marks);
  const inside = prefix > 0;
  const inherited = inside ? styles[prefix - 1] : {};
  return compactMarks([...styles.slice(0, prefix), ...Array.from({ length: next.length - prefix - suffix }, () => ({ ...inherited })), ...styles.slice(previous.length - suffix)]);
}
export type RichRun = { text: string; start: number; style: WordStyle; width: number };
export type RichLine = { runs: RichRun[]; width: number; height: number; fontSize: number; inset: number };
type Measure = (text: string, size: number, style: WordStyle) => number;
export function wrapRichText(text: string, marks: TextMark[], width: number, size: number, measure: Measure): RichLine[] {
  const measured = (value: string, style: WordStyle) => measure(value, size * (style.size ?? 100) / 100, style);
  const styles = textStyleMap(text, marks);
  const makeRuns = (value: string, start: number) => {
    const runs: RichRun[] = []; let offset = start;
    for (const char of Array.from(value)) {
      const style = styles[offset] || {}, last = runs[runs.length - 1];
      if (last && JSON.stringify(last.style) === JSON.stringify(style)) { last.text += char; last.width = measured(last.text, style); }
      else runs.push({ text: char, start: offset, style, width: measured(char, style) });
      offset += char.length;
    }
    return runs;
  };
  const empty = (): RichLine => ({ runs: [], width: 0, height: size * 1.3, fontSize: size, inset: 0 });
  const lines: RichLine[] = []; let line = empty(), space: RichRun[] = [];
  const flush = () => {
    line.fontSize = Math.max(size, ...line.runs.map(run => size * (run.style.size ?? 100) / 100));
    line.inset = Math.max(0, ...line.runs.map(run => run.style.highlight ? run.style.highlightPadding ?? 0 : 0));
    line.height = line.inset + Math.max(line.fontSize * 1.3, ...line.runs.map(run => {
      const runSize = size * (run.style.size ?? 100) / 100, offset = (line.fontSize - runSize) * .85;
      const stroke = run.style.underlineWidth ?? Math.max(1.5, runSize / 25);
      const underlineBottom = run.style.underline ? runSize * 1.12 + stroke * (run.style.underlineStyle === 'double' ? 3 : run.style.underlineStyle === 'wavy' ? 1.5 : .5) : 0;
      return offset + Math.max(runSize * 1.17 + (run.style.highlight ? run.style.highlightPadding ?? 0 : 0), underlineBottom);
    }));
    lines.push(line); line = empty(); space = [];
  };
  for (const match of text.matchAll(/\r?\n|[^\S\r\n]+|[^\s]+/gu)) {
    if (match[0].includes('\n')) { flush(); continue; }
    if (/^\s+$/.test(match[0])) { if (line.runs.length) space = makeRuns(' ', match.index!); continue; }
    const runs = makeRuns(match[0], match.index!), wordWidth = runs.reduce((sum, run) => sum + run.width, 0), spaceWidth = space.reduce((sum, run) => sum + run.width, 0);
    if (line.runs.length && line.width + spaceWidth + wordWidth > width) flush();
    if (line.runs.length) { line.runs.push(...space); line.width += spaceWidth; } space = [];
    if (wordWidth <= width) { line.runs.push(...runs); line.width += wordWidth; }
    else for (const run of runs) { let offset = run.start; for (const char of Array.from(run.text)) {
      const charWidth = measured(char, run.style);
      if (line.runs.length && line.width + charWidth > width) flush();
      line.runs.push({ ...run, start: offset, text: char, width: charWidth }); line.width += charWidth; offset += char.length;
    } }
  }
  flush(); return lines;
}
const richHeight = (lines: RichLine[], columns: number) => {
  const half = Math.ceil(lines.length / columns);
  return Math.max(lines.slice(0, half).reduce((sum, line) => sum + line.height, 0), columns === 2 ? lines.slice(half).reduce((sum, line) => sum + line.height, 0) : 0);
};
export function layoutRichText(text: string, marks: TextMark[], width: number, height: number, desired: number, minimum: number, measure: Measure, columns = 1) {
  let size = desired, lines: RichLine[] = [];
  while (size >= minimum) {
    lines = wrapRichText(text, marks, width, size, measure);
    if (richHeight(lines, columns) <= height && lines.every(line => line.width <= width + .01)) return { lines, size, fits: true, usedHeight: richHeight(lines, columns) };
    size -= 2;
  }
  lines = wrapRichText(text, marks, width, minimum, measure);
  return { lines, size: minimum, fits: richHeight(lines, columns) <= height && lines.every(line => line.width <= width + .01), usedHeight: richHeight(lines, columns) };
}
export function drawRichText(context: CanvasRenderingContext2D, text: string, marks: TextMark[], x: number, y: number, width: number, height: number, desired: number, minimum: number, family: string, bold: boolean, color: string, columns = 1, gap = 54, frame: CarouselTextFrame = {}, canvasSize = { width: 1080, height: 1350 }) {
  const padding = frame.padding ?? 0, contentWidth = Math.max(10, width - 2 * padding);
  const columnWidth = columns === 2 ? (contentWidth - gap) / 2 : contentWidth;
  const font = (size: number, style: WordStyle) => `${style.italic ? 'italic ' : ''}${(style.bold ?? bold) ? 700 : 400} ${size}px "${carouselFont(style.font, family)}"`;
  const block = layoutRichText(text, marks, columnWidth, Math.max(10, height - 2 * padding), desired, minimum, (value, size, style) => { context.font = font(size, style); return context.measureText(value).width; }, columns);
  const half = Math.ceil(block.lines.length / columns);
  const boxWidth = frame.width === undefined && (!frame.align || frame.align === 'left') && columns === 1 ? Math.min(width, Math.max(1, ...block.lines.map(line => line.width)) + 2 * padding) : width;
  const boxHeight = block.usedHeight + 2 * padding, rotation = frame.rotation ?? 0;
  const center = frame.x !== undefined || frame.y !== undefined ? clampTextCenter({ width: boxWidth, height: boxHeight, rotation }, frame.x === undefined ? x + boxWidth / 2 : frame.x * canvasSize.width / 100, frame.y === undefined ? y + boxHeight / 2 : frame.y * canvasSize.height / 100, canvasSize.width, canvasSize.height) : { x: x + boxWidth / 2, y: y + boxHeight / 2 };
  const bounds: CarouselTextBounds = { ...center, width: boxWidth, height: boxHeight, rotation }, hits: TextHitRun[] = [], tops = [0, 0];
  context.save(); context.translate(center.x, center.y); context.rotate(rotation * Math.PI / 180); context.textAlign = 'left'; context.textBaseline = 'top';
  if (frame.fill && safeColor(frame.fill)) { context.save(); context.globalAlpha = (frame.opacity ?? 100) / 100; context.fillStyle = frame.fill; context.beginPath(); context.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, Math.min(frame.radius ?? 0, boxHeight / 2)); context.fill(); context.restore(); }
  block.lines.forEach((line, index) => {
    const column = columns === 2 && index >= half ? 1 : 0;
    const rowTop = tops[column]; tops[column] += line.height;
    if (tops[column] > height - padding * 2 + .01) return;
    const align = frame.align === 'center' ? (columnWidth - line.width) / 2 : frame.align === 'right' ? columnWidth - line.width : 0;
    let left = -boxWidth / 2 + padding + column * (columnWidth + gap) + align;
    const lineTop = -boxHeight / 2 + padding + rowTop + line.inset, maxSize = line.fontSize;
    for (const run of line.runs) {
      const size = block.size * (run.style.size ?? 100) / 100, top = lineTop + (maxSize - size) * .85;
      context.font = font(size, run.style);
      if (run.style.highlight && safeColor(run.style.highlight)) { const pad = run.style.highlightPadding ?? 0; context.save(); context.globalAlpha = (run.style.highlightOpacity ?? 100) / 100; context.fillStyle = run.style.highlight; context.beginPath(); context.roundRect(left - 1 - pad, top - pad, run.width + 2 + pad * 2, size * 1.17 + pad * 2, Math.min(run.style.highlightRadius ?? 0, size / 2)); context.fill(); context.restore(); }
      context.fillStyle = safeColor(run.style.color) ? run.style.color! : color; context.fillText(run.text, left, top);
      if (run.style.underline) {
        context.save(); context.strokeStyle = safeColor(run.style.underlineColor) ? run.style.underlineColor! : context.fillStyle; context.lineWidth = run.style.underlineWidth ?? Math.max(1.5, size / 25);
        const base = top + size * 1.12;
        if (run.style.underlineStyle === 'dashed') context.setLineDash([context.lineWidth * 3, context.lineWidth * 2]);
        context.beginPath(); context.moveTo(left, base);
        if (run.style.underlineStyle === 'wavy') { for (let dx = 0; dx <= run.width; dx += 2) context.lineTo(left + dx, base + Math.sin(dx / 5) * Math.max(2, context.lineWidth)); }
        else context.lineTo(left + run.width, base);
        if (run.style.underlineStyle === 'double') { context.moveTo(left, base + context.lineWidth * 2.5); context.lineTo(left + run.width, base + context.lineWidth * 2.5); }
        context.stroke(); context.restore();
      }
      hits.push({ start: run.start, end: run.start + run.text.length, x: left, y: top, width: run.width, height: size * 1.2 });
      left += run.width;
    }
  });
  context.restore(); return { ...block, usedHeight: boxHeight, bounds, hits };
}
