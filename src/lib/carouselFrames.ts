import { fitImageRect } from './localDesignExport';
export const CAROUSEL_IMAGE_FRAMES = [{ id: 'rounded', name: 'Zaokrąglona' }, { id: 'rectangle', name: 'Prostokąt' }, { id: 'circle', name: 'Koło' }, { id: 'polaroid', name: 'Polaroid' }, { id: 'newspaper', name: 'Wycinek gazety' }, { id: 'cutout', name: 'Bez kadrowania · wycięta postać' }] as const;
export function drawCarouselImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, frame = 'rounded', grayscale = false) {
  context.save();
  if (frame === 'cutout') {
    const fit = fitImageRect(image.naturalWidth, image.naturalHeight, width, height, 'contain');
    context.drawImage(image, x + fit.x, y + fit.y, fit.width, fit.height); context.restore(); return;
  }
  if (frame === 'circle') { const size = Math.min(width, height); x += (width - size) / 2; y += (height - size) / 2; width = height = size; }
  if (frame === 'polaroid') {
    context.shadowColor = '#00000040'; context.shadowBlur = 16; context.shadowOffsetY = 8; context.fillStyle = '#ffffff'; context.fillRect(x, y, width, height); context.shadowColor = 'transparent';
    x += 16; y += 16; width -= 32; height -= 48;
  }
  context.beginPath();
  if (frame === 'circle') context.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
  else if (frame === 'newspaper') {
    context.moveTo(x, y + 6);
    for (let step = 0; step <= 28; step++) context.lineTo(x + width * step / 28, y + (step % 2 ? 9 : 1));
    for (let step = 0; step <= 10; step++) context.lineTo(x + width - (step % 2 ? 7 : 0), y + height * step / 10);
    for (let step = 28; step >= 0; step--) context.lineTo(x + width * step / 28, y + height - (step % 2 ? 8 : 0));
    for (let step = 10; step >= 0; step--) context.lineTo(x + (step % 2 ? 8 : 0), y + height * step / 10);
    context.closePath();
  } else context.roundRect(x, y, width, height, frame === 'rounded' ? Math.min(22, height / 4) : 0);
  context.clip();
  const rect = fitImageRect(image.naturalWidth, image.naturalHeight, width, height, 'cover');
  if (grayscale) context.filter = 'grayscale(1)'; context.drawImage(image, x + rect.x, y + rect.y, rect.width, rect.height); context.restore();
}
