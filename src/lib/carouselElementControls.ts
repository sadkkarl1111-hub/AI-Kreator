import { MAX_CAROUSEL_ELEMENTS, MAX_CUSTOM_STICKERS, type SlideSticker } from './carouselStickers';

export function canDuplicateCarouselSticker(stickers: SlideSticker[], id: string) {
  const item = stickers.find(item => item.id === id);
  return Boolean(item && stickers.length < MAX_CAROUSEL_ELEMENTS && (item.kind !== 'custom' || stickers.filter(item => item.kind === 'custom').length < MAX_CUSTOM_STICKERS));
}
export function duplicateCarouselSticker(stickers: SlideSticker[], id: string): SlideSticker | null {
  if (!canDuplicateCarouselSticker(stickers, id)) return null;
  const item = stickers.find(item => item.id === id)!;
  return { ...item, id: crypto.randomUUID(), x: Math.min(100, item.x + 3), y: Math.min(100, item.y + 3), locked: false, hidden: false };
}

type Rect = { left: number; top: number; width: number; height: number };
export function carouselElementToolbarPosition(canvas: Rect, stage: Rect, width: number, height: number, sticker: Pick<SlideSticker, 'x' | 'y' | 'size' | 'rotation'>, toolbar: { width: number; height: number }, viewportHeight: number, bounds?: { width: number; height: number }) {
  if (![canvas.width, canvas.height, stage.width, stage.height, width, height].every(value => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(canvas.width / width, canvas.height / height);
  const x = canvas.left - stage.left + (canvas.width - width * scale) / 2 + width * scale * sticker.x / 100;
  const y = canvas.top - stage.top + (canvas.height - height * scale) / 2 + height * scale * sticker.y / 100;
  const angle = sticker.rotation * Math.PI / 180;
  const radius = bounds ? ((bounds.width * Math.abs(Math.sin(angle)) + bounds.height * Math.abs(Math.cos(angle))) / 2 + 8) * scale : (width * sticker.size / 200 + 8) * scale * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)));
  const minTop = Math.max(6, 66 - stage.top), maxBottom = Math.min(stage.height - 6, viewportHeight - stage.top - 6);
  if (maxBottom <= minTop || y + radius < minTop || y - radius > maxBottom) return null;
  const top = y - radius - toolbar.height - 8;
  const preferred = top >= minTop ? top : y + radius + 8;
  return {
    left: Math.max(6, Math.min(stage.width - toolbar.width - 6, x - toolbar.width / 2)),
    top: Math.max(minTop, Math.min(maxBottom - toolbar.height, preferred)),
  };
}
