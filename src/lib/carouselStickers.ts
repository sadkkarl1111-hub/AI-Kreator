import { gifFrameAt, type StickerImages } from './carouselStickerAssets';
import { CAROUSEL_DECORATIONS, drawCarouselDecoration } from './carouselDecorations';
export const MAX_CAROUSEL_ELEMENTS = 16;
export const MAX_CUSTOM_STICKERS = 8;
export type StickerMotion = 'none' | 'pulse' | 'bounce' | 'wiggle' | 'spin';
export type SlideSticker = { id: string; kind: string; x: number; y: number; size: number; rotation: number; color: string; motion: StickerMotion; emoji?: string; layer?: 'back' | 'front'; hidden?: boolean; locked?: boolean; asset?: { data: string; name: string } };
export const validCarouselEmoji = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 32 && value.trim() === value && [...value].every(char => char.codePointAt(0)! >= 32 && char.codePointAt(0) !== 127);
export function createCarouselEmoji(emoji: string, color: string): SlideSticker | null {
  return validCarouselEmoji(emoji) ? { id: crypto.randomUUID(), kind: 'emoji', emoji, x: 50, y: 50, size: 16, rotation: 0, color, motion: 'none' } : null;
}
export const STICKER_MOTIONS = [{ id: 'none', name: 'Bez animacji' }, { id: 'pulse', name: 'Pulsowanie' }, { id: 'bounce', name: 'Podskakiwanie' }, { id: 'wiggle', name: 'Kołysanie' }, { id: 'spin', name: 'Obrót' }] as const;
type StickerDefinition = { id: string; name: string; group: string; symbol?: string; motion: StickerMotion; size?: number; rotation?: number };
export const CAROUSEL_STICKERS: readonly StickerDefinition[] = [
  { id: 'arrow-right', name: 'Strzałka w prawo', group: 'Strzałki', symbol: '→', motion: 'bounce' },
  { id: 'arrow-down', name: 'Strzałka w dół', group: 'Strzałki', symbol: '↓', motion: 'bounce' },
  { id: 'arrow-up', name: 'Strzałka w górę', group: 'Strzałki', symbol: '↑', motion: 'bounce' },
  { id: 'arrow-left', name: 'Strzałka w lewo', group: 'Strzałki', symbol: '←', motion: 'bounce' },
  { id: 'arrow-curve', name: 'Zakręcona strzałka', group: 'Strzałki', symbol: '↪', motion: 'wiggle' },
  { id: 'chevrons', name: 'Przesuń dalej', group: 'Strzałki', symbol: '»', motion: 'bounce' },
  { id: 'star', name: 'Gwiazda', group: 'Akcenty', symbol: '★', motion: 'pulse' },
  { id: 'sparkles', name: 'Błysk', group: 'Akcenty', symbol: '✦', motion: 'pulse' },
  { id: 'burst', name: 'Rozbłysk', group: 'Akcenty', symbol: '✹', motion: 'spin' },
  { id: 'heart', name: 'Serce', group: 'Akcenty', symbol: '♥', motion: 'pulse' },
  { id: 'lightning', name: 'Energia', group: 'Akcenty', symbol: 'ϟ', motion: 'wiggle' },
  { id: 'target', name: 'Cel', group: 'Akcenty', symbol: '◎', motion: 'pulse' },
  { id: 'check', name: 'Gotowe', group: 'Znaki', symbol: '✓', motion: 'bounce' },
  { id: 'cross', name: 'Nie', group: 'Znaki', symbol: '×', motion: 'wiggle' },
  { id: 'exclamation', name: 'Ważne', group: 'Znaki', symbol: '!', motion: 'pulse' },
  { id: 'question', name: 'Pytanie', group: 'Znaki', symbol: '?', motion: 'wiggle' },
  { id: 'plus', name: 'Plus', group: 'Znaki', symbol: '+', motion: 'spin' },
  { id: 'infinity', name: 'Bez końca', group: 'Znaki', symbol: '∞', motion: 'pulse' },
  { id: 'promo', name: 'Promocja', group: 'Etykiety', symbol: 'PROMO', motion: 'wiggle' },
  { id: 'new', name: 'Nowość', group: 'Etykiety', symbol: 'NOWE', motion: 'pulse' },
  { id: 'wow', name: 'Wow', group: 'Etykiety', symbol: 'WOW!', motion: 'bounce' },
  { id: 'tip', name: 'Wskazówka', group: 'Etykiety', symbol: 'TIP', motion: 'wiggle' },
  { id: 'save', name: 'Zapisz', group: 'Etykiety', symbol: 'ZAPISZ', motion: 'pulse' },
  { id: 'start', name: 'Start', group: 'Etykiety', symbol: 'START', motion: 'bounce' },
  ...CAROUSEL_DECORATIONS.map(item => ({ ...item, motion: 'none' as const })),
] as const;
export const CAROUSEL_STICKER_GROUPS = ['Wszystkie', ...new Set(CAROUSEL_STICKERS.map(item => item.group))];
export function createCarouselSticker(kind: string, color: string, x = 76, y = 75): SlideSticker | null {
  const item = CAROUSEL_STICKERS.find(item => item.id === kind); if (!item || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { id: crypto.randomUUID(), kind, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)), color, size: item.size || 16, rotation: item.rotation || 0, motion: item.motion };
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function validateStickers(value: unknown): SlideSticker[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_CAROUSEL_ELEMENTS) throw new Error(`Na slajdzie może być maksymalnie ${MAX_CAROUSEL_ELEMENTS} elementów.`);
  if (value.filter(sticker => sticker?.kind === 'custom').length > MAX_CUSTOM_STICKERS) throw new Error(`Na slajdzie może być maksymalnie ${MAX_CUSTOM_STICKERS} własnych naklejek.`);
  const ids = new Set<string>();
  return value.map(sticker => {
    if (!sticker || typeof sticker.id !== 'string' || !sticker.id || sticker.id.length > 100 || ids.has(sticker.id) || (!['custom', 'emoji'].includes(sticker.kind) && !CAROUSEL_STICKERS.some(item => item.id === sticker.kind)) || !STICKER_MOTIONS.some(item => item.id === sticker.motion) || !/^#[\da-f]{6}$/i.test(sticker.color)) throw new Error('Projekt zawiera niepoprawną naklejkę.');
    for (const key of ['x', 'y', 'size', 'rotation']) if (!Number.isFinite(sticker[key])) throw new Error('Niepoprawne położenie naklejki.');
    if (sticker.size < 6 || sticker.size > 60 || sticker.x < 0 || sticker.x > 100 || sticker.y < 0 || sticker.y > 100 || Math.abs(sticker.rotation) > 180) throw new Error('Naklejka jest poza dozwolonym zakresem.');
    ids.add(sticker.id);
    const result: SlideSticker = { id: sticker.id, kind: sticker.kind, x: sticker.x, y: sticker.y, size: sticker.size, rotation: sticker.rotation, color: sticker.color, motion: sticker.motion };
    if (sticker.kind === 'emoji') { if (!validCarouselEmoji(sticker.emoji)) throw new Error('Niepoprawne emoji w projekcie.'); result.emoji = sticker.emoji; }
    if (sticker.layer !== undefined) { if (!['back', 'front'].includes(sticker.layer)) throw new Error('Niepoprawna warstwa.'); result.layer = sticker.layer; }
    for (const key of ['hidden', 'locked'] as const) if (sticker[key] !== undefined) { if (typeof sticker[key] !== 'boolean') throw new Error('Niepoprawne ustawienia warstwy.'); result[key] = sticker[key]; }
    if (sticker.kind === 'custom') { if (!sticker.asset || typeof sticker.asset.data !== 'string' || sticker.asset.data.length > 3_000_000 || !/^data:image\/(png|gif);base64,[a-z\d+/]+=*$/i.test(sticker.asset.data) || typeof sticker.asset.name !== 'string' || sticker.asset.name.length > 100) throw new Error('Niepoprawna własna naklejka.'); result.asset = { data: sticker.asset.data, name: sticker.asset.name }; }
    return result;
  });
}
export function stickerTransform(sticker: SlideSticker, time = 0) {
  const phase = time / 1600 * Math.PI * 2;
  return { scale: sticker.motion === 'pulse' ? 1 + Math.sin(phase) * 0.1 : 1, dy: sticker.motion === 'bounce' ? -Math.sin(phase) * 10 : 0, rotation: sticker.rotation + (sticker.motion === 'wiggle' ? Math.sin(phase) * 9 : sticker.motion === 'spin' ? phase * 180 / Math.PI : 0) };
}
export function stickerHit(sticker: SlideSticker, x: number, y: number, width: number, height: number) {
  const radians = -sticker.rotation * Math.PI / 180, dx = x - width * sticker.x / 100, dy = y - height * sticker.y / 100;
  const localX = dx * Math.cos(radians) - dy * Math.sin(radians), localY = dx * Math.sin(radians) + dy * Math.cos(radians);
  return Math.abs(localX) <= width * sticker.size / 200 && Math.abs(localY) <= width * sticker.size / 200;
}
export function moveSticker(sticker: SlideSticker, x: number, y: number) { return { ...sticker, x: clamp(x, 0, 100), y: clamp(y, 0, 100) }; }
export const stickerName = (sticker: SlideSticker) => sticker.emoji ? `Emoji ${sticker.emoji}` : sticker.asset?.name || CAROUSEL_STICKERS.find(item => item.id === sticker.kind)?.name || 'Naklejka';
export function reorderSticker(stickers: SlideSticker[], id: string, front: boolean) {
  const sticker = stickers.find(item => item.id === id); if (!sticker) return stickers;
  const rest = stickers.filter(item => item.id !== id); return front ? [...rest, sticker] : [sticker, ...rest];
}
export function snapStickerPosition(x: number, y: number, others: SlideSticker[] = []) {
  const nearest = (value: number, points: number[]) => points.reduce<number | undefined>((best, point) => Math.abs(value - point) < 1.4 && (best === undefined || Math.abs(value - point) < Math.abs(value - best)) ? point : best, undefined);
  const guideX = nearest(x, [50, ...others.filter(item => !item.hidden).map(item => item.x)]), guideY = nearest(y, [50, ...others.filter(item => !item.hidden).map(item => item.y)]);
  return { x: clamp(guideX ?? x, 0, 100), y: clamp(guideY ?? y, 0, 100), guideX, guideY };
}

export function drawSlideStickers(context: CanvasRenderingContext2D, stickers: SlideSticker[] = [], width: number, height: number, time = 0, images: StickerImages = new Map()) {
  for (const sticker of stickers) {
    if (sticker.hidden) continue;
    const item = CAROUSEL_STICKERS.find(item => item.id === sticker.kind);
    const asset = sticker.asset ? images.get(sticker.asset.data) : undefined;
    if (!item && !asset && !(sticker.kind === 'emoji' && validCarouselEmoji(sticker.emoji))) continue;
    const transform = stickerTransform(sticker, time), size = width * sticker.size / 100;
    context.save(); context.translate(width * sticker.x / 100, height * sticker.y / 100 + transform.dy); context.rotate(transform.rotation * Math.PI / 180); context.scale(transform.scale * size / 200, transform.scale * size / 200);
    if (asset) { const scale = 200 / Math.max(asset.width, asset.height), w = asset.width * scale, h = asset.height * scale; context.drawImage(gifFrameAt(asset, time), -w / 2, -h / 2, w, h); context.restore(); continue; }
    if (sticker.kind === 'emoji') { context.font = '160px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = sticker.color; context.fillText(sticker.emoji!, 0, 8, 180); context.restore(); continue; }
    const color = /^#[\da-f]{6}$/i.test(sticker.color) ? sticker.color : '#ffcc00';
    context.shadowColor = '#00000030'; context.shadowBlur = 6; context.shadowOffsetY = 3;
    context.fillStyle = color; context.strokeStyle = color; context.lineWidth = 16; context.lineCap = 'round'; context.lineJoin = 'round';
    if (drawCarouselDecoration(context, item.id, color)) { context.restore(); continue; }
    if (item.id.startsWith('arrow-') && item.id !== 'arrow-curve') {
      const rotation = ({ 'arrow-right': 0, 'arrow-down': Math.PI / 2, 'arrow-left': Math.PI, 'arrow-up': -Math.PI / 2 })[item.id] || 0;
      context.rotate(rotation); context.beginPath(); context.moveTo(-74, 0); context.lineTo(70, 0); context.moveTo(15, -55); context.lineTo(72, 0); context.lineTo(15, 55); context.stroke();
    } else if (item.id === 'heart') {
      context.beginPath(); context.moveTo(0, 74); context.bezierCurveTo(-150, -15, -65, -116, 0, -46); context.bezierCurveTo(65, -116, 150, -15, 0, 74); context.fill();
    } else if (['star', 'sparkles', 'burst'].includes(item.id)) {
      const points = item.id === 'star' ? 10 : item.id === 'sparkles' ? 8 : 24;
      context.beginPath(); for (let index = 0; index < points; index++) { const angle = index / points * Math.PI * 2 - Math.PI / 2, radius = index % 2 ? (item.id === 'sparkles' ? 22 : 40) : 86; const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius; if (index) context.lineTo(x, y); else context.moveTo(x, y); } context.closePath(); context.fill();
    } else if (item.id === 'lightning') {
      context.beginPath(); context.moveTo(8, -92); context.lineTo(-62, 15); context.lineTo(-5, 10); context.lineTo(-25, 94); context.lineTo(69, -23); context.lineTo(11, -18); context.closePath(); context.fill();
    } else if (item.id === 'target') {
      for (const radius of [78, 46, 13]) { context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); if (radius === 13) context.fill(); else context.stroke(); }
    } else if (item.group === 'Etykiety') {
      context.beginPath(); context.roundRect(-96, -47, 192, 94, 22); context.fill(); context.shadowBlur = 0; context.shadowOffsetY = 0;
      const bright = parseInt(color.slice(1, 3), 16) * .299 + parseInt(color.slice(3, 5), 16) * .587 + parseInt(color.slice(5, 7), 16) * .114 > 145;
      context.fillStyle = bright ? '#17142b' : '#ffffff'; context.font = `900 ${item.symbol.length > 4 ? 38 : 48}px Arial`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(item.symbol, 0, 3);
    } else { context.font = `700 ${item.id === 'arrow-curve' ? 170 : 160}px Arial`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(item.symbol, 0, 12); }
    context.restore();
  }
}
