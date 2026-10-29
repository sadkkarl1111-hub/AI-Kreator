import { ensureCarouselFonts } from '@/lib/carouselTemplateAssets';
import { memo, useEffect, useRef } from 'react';
import { renderCarouselSlide, type CarouselSlide, type CarouselDesign } from '@/lib/carouselDesign';
import { decodeLocalImage } from '@/lib/localDesignExport';
import { loadStickerImages } from '@/lib/carouselStickerAssets';

export const CarouselSlideThumbnail = memo(function CarouselSlideThumbnail({ slide, design, index, count }: { slide: CarouselSlide; design: CarouselDesign; index: number; count: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureCarouselFonts(design, [slide]);
        const [image, logo, background, stickerImages] = await Promise.all([slide.image ? decodeLocalImage(slide.image) : null, design.logo ? decodeLocalImage(design.logo) : null, design.backgroundImage ? decodeLocalImage(design.backgroundImage) : null, loadStickerImages(slide.stickers)]);
        if (cancelled || !canvas.current) return;
        const full = document.createElement('canvas'); renderCarouselSlide(full, slide, design, index, count, image, { logo, background, stickerImages });
        const target = canvas.current; target.width = 96; target.height = design.format === 'square' ? 96 : 120;
        target.getContext('2d')?.drawImage(full, 0, 0, target.width, target.height); full.width = 1; full.height = 1;
      } catch { /* Keep the slide number usable when a project image is unavailable. */ }
    })();
    return () => { cancelled = true; };
  }, [slide, design, index, count]);
  return <canvas ref={canvas} aria-hidden="true" className="h-8 w-7 rounded object-contain"/>;
});
