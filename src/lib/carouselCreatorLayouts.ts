import type { CarouselSlide } from './carouselDesign';
import type { CarouselTextField } from './carouselTextGeometry';
import { carouselContrast } from './carouselConversion';
import { drawCarouselImage } from './carouselFrames';
import { fitImageRect } from './localDesignExport';

type Text = (field: CarouselTextField, x: number, y: number, width: number, height: number, size: number, minimum: number, bold: boolean, color: string) => number;
type Options = { context: CanvasRenderingContext2D; slide: CarouselSlide; composition: string; width: number; height: number; index: number; image?: HTMLImageElement | null; foreground: string; muted: string; accent: string; text: Text };

// Same drawing path is used by the editor, thumbnails, PNG, PDF and GIF exports.
// Only decoration is fixed: all three copy fields retain their text hit boxes.
export function renderCreatorComposition({ context: ctx, slide, composition, width: w, height: h, index, image, foreground, muted, accent, text }: Options) {
  const p = 82, full = w - 2 * p;
  const rect = (x: number, y: number, width: number, height: number, color: string, opacity = 1, radius = 0) => {
    ctx.save(); ctx.globalAlpha = opacity; ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fill(); ctx.restore();
  };
  const photo = (x: number, y: number, width: number, height: number) => {
    if (!image) return;
    if (slide.imageFrame === 'cutout') {
      const fit = fitImageRect(image.naturalWidth, image.naturalHeight, width, height, 'contain');
      ctx.drawImage(image, x + fit.x, y + fit.y, fit.width, fit.height);
    } else drawCarouselImage(ctx, image, x, y, width, height, slide.imageFrame || 'rounded');
    if (slide.imageSource === 'ai-sample') {
      ctx.save(); ctx.font = '18px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = muted;
      ctx.fillText('Przykładowa postać AI', x + width / 2, y + height + 25); ctx.restore();
    }
  };
  if (composition === 'creator-cover') {
    rect(p, h * .155, 76, 8, accent);
    text('title', p, h * .202, full, h * .29, 132, 52, true, foreground);
    if (image) {
      ctx.save(); ctx.fillStyle = accent; ctx.globalAlpha = .15; ctx.beginPath(); ctx.arc(w * .74, h * .72, w * .24, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      photo(w * .40, h * .50, w * .56, h * .38);
      text('body', p, h * .60, w * .30, h * .23, 36, 26, false, muted);
    } else {
      text('body', p, h * .62, full * .88, h * .22, 44, 28, false, muted);
      rect(w - 165, h * .83, 83, 8, accent);
    }
  } else if (composition === 'creator-portrait') {
    if (image) {
      rect(w * .52, h * .25, w * .40, h * .61, accent, .14, 28);
      photo(w * .49, h * .27, w * .45, h * .60);
      text('title', p, h * .225, w * .39, h * .33, 117, 50, true, foreground);
      text('body', p, h * .64, w * .34, h * .19, 36, 26, false, muted);
    } else {
      rect(w * .72, h * .55, w * .20, h * .26, accent, .14, 18);
      text('title', p, h * .225, full, h * .31, 132, 52, true, foreground);
      text('body', p, h * .64, full * .68, h * .19, 43, 28, false, muted);
    }
  } else if (composition === 'creator-number') {
    ctx.save(); ctx.globalAlpha = .11; ctx.fillStyle = foreground; ctx.font = `400 ${h * .32}px Anton, Impact, sans-serif`; ctx.textAlign = 'right';
    ctx.fillText(String(Math.max(1, index)).padStart(2, '0'), w - p + 15, h * .48); ctx.restore();
    rect(p, h * .18, 9, h * .29, accent);
    text('title', p + 35, h * .25, full - 35, h * .29, 108, 44, true, foreground);
    text('body', p + 35, h * .64, image ? full * .56 : full - 35, h * .20, 43, 28, false, muted);
    if (image) photo(w * .66, h * .60, w * .25, h * .24);
  } else if (composition === 'creator-split') {
    const top = h * .285, panelWidth = (full - 28) / 2, panelHeight = h * .55;
    rect(p, top, panelWidth, panelHeight, foreground, .06, 24);
    rect(p + panelWidth + 28, top, panelWidth, panelHeight, accent, 1, 24);
    text('title', p + 28, top + 46, panelWidth - 56, panelHeight - 90, 70, 30, true, foreground);
    text('body', p + panelWidth + 56, top + 46, panelWidth - 56, panelHeight - 90, 57, 28, true, carouselContrast(accent));
  } else if (composition === 'creator-story') {
    text('title', p, h * .205, full, h * .25, 105, 44, true, foreground);
    if (image) {
      rect(p - 12, h * .51 - 12, w * .42 + 24, h * .32 + 24, accent, .13, 25);
      photo(p, h * .51, w * .42, h * .32);
      text('body', w * .56, h * .52, w * .36, h * .31, 38, 26, false, muted);
    } else {
      rect(p, h * .50, 100, 8, accent);
      text('body', p, h * .57, full * .92, h * .25, 46, 28, false, muted);
    }
  } else if (composition === 'ending-creator') {
    ctx.save(); ctx.fillStyle = accent; ctx.globalAlpha = .10; ctx.beginPath(); ctx.arc(w / 2, h * .42, w * .40, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    text('title', p, h * .245, full, h * .245, 118, 48, true, foreground);
    text('body', p, h * .53, image ? full * .58 : full, h * .16, 40, 26, false, muted);
    if (image) photo(w * .68, h * .52, w * .21, h * .18);
  }
}
