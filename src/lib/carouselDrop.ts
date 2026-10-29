export const CAROUSEL_ELEMENT_MIME = 'application/x-ai-kreator-carousel-element';
export type SlideCanvasRect = { left: number; top: number; width: number; height: number };
export function carouselDropPoint(rect: SlideCanvasRect, width: number, height: number, clientX: number, clientY: number) {
  const scale = Math.min(rect.width / width, rect.height / height);
  if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  const x = (clientX - rect.left - (rect.width - width * scale) / 2) / scale;
  const y = (clientY - rect.top - (rect.height - height * scale) / 2) / scale;
  return x < 0 || y < 0 || x > width || y > height ? null : { x: x / width * 100, y: y / height * 100 };
}
