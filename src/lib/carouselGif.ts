import { drawSlideStickers, type SlideSticker } from './carouselStickers';
import type { StickerImages } from './carouselStickerAssets';
export function carouselGifDuration(stickers: SlideSticker[], images?: StickerImages) {
  const periods = stickers.filter(sticker => !sticker.hidden).flatMap(sticker => [sticker.motion !== 'none' ? 1600 : 0, sticker.asset?.data.startsWith('data:image/gif;') ? images?.get(sticker.asset.data)?.duration || 0 : 0]).filter(Boolean);
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  let duration = periods[0] || 1600;
  for (const period of periods.slice(1)) { duration = duration / gcd(duration, period) * period; if (duration > 8000) return Math.min(8000, Math.max(...periods)); }
  return duration;
}

export async function exportSlideGif(base: HTMLCanvasElement, stickers: SlideSticker[], signal: AbortSignal, progress: (frame: number, total: number) => void, options: { images?: StickerImages; foreground?: HTMLCanvasElement } = {}) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const duration = carouselGifDuration(stickers, options.images);
  const width = 540, height = Math.round(base.height * width / base.width), total = Math.ceil(duration / 100);
  const target = document.createElement('canvas'); target.width = width; target.height = height;
  const context = target.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Nie udało się przygotować GIF.');
  const gif = GIFEncoder();
  for (let frame = 0; frame < total; frame++) {
    signal.throwIfAborted();
    context.drawImage(base, 0, 0, width, height);
    context.save(); context.scale(width / base.width, height / base.height);
    if (options.foreground) { drawSlideStickers(context, stickers.filter(sticker => sticker.layer === 'back'), base.width, base.height, frame * 100, options.images); context.drawImage(options.foreground, 0, 0); }
    drawSlideStickers(context, options.foreground ? stickers.filter(sticker => sticker.layer !== 'back') : stickers, base.width, base.height, frame * 100, options.images); context.restore();
    const rgba = context.getImageData(0, 0, width, height).data;
    const palette = quantize(rgba, 256, { format: 'rgb565' });
    const indexed = applyPalette(rgba, palette);
    gif.writeFrame(indexed, width, height, { palette, delay: 100, repeat: 0 });
    progress(frame + 1, total); await new Promise(resolve => setTimeout(resolve, 0));
  }
  signal.throwIfAborted(); gif.finish(); target.width = 1; target.height = 1;
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
