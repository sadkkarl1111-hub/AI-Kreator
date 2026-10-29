export type BatchOptions = {
  format: 'jpeg' | 'png' | 'webp'; quality: number; maxEdge: number; background: string;
  watermark: 'none' | 'text' | 'logo'; text: string; logo: string; position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity: number; size: number; color: string;
};
export const defaultBatchOptions: BatchOptions = { format: 'jpeg', quality: 85, maxEdge: 1920, background: '#ffffff', watermark: 'none', text: '© Twoja Marka', logo: '', position: 'bottom-right', opacity: 60, size: 14, color: '#ffffff' };
export const batchMime = (format: BatchOptions['format']) => ({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' })[format];
export function batchImageDimensions(width: number, height: number, maxEdge: number) {
  if (width < 1 || height < 1 || !Number.isFinite(width + height) || width * height > 40_000_000) throw new Error('Obraz przekracza limit 40 megapikseli.');
  const edge = [0, 1080, 1600, 1920, 2560].includes(maxEdge) ? maxEdge : 1920;
  const scale = edge ? Math.min(1, edge / Math.max(width, height)) : 1;
  if (Math.round(width * scale) * Math.round(height * scale) > 20_000_000) throw new Error('Wybierz mniejszy rozmiar wynikowy dla tego obrazu.');
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function batchOutputName(original: string, index: number, format: BatchOptions['format']) {
  const base = original.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 72) || 'obraz';
  return `${String(index + 1).padStart(2, '0')}-${base}.${format === 'jpeg' ? 'jpg' : format}`;
}
export function watermarkRect(width: number, height: number, markWidth: number, markHeight: number, position: BatchOptions['position']) {
  const padding = Math.max(2, Math.min(width, height) * 0.035);
  return { x: position === 'center' ? (width - markWidth) / 2 : position.endsWith('right') ? width - padding - markWidth : padding, y: position === 'center' ? (height - markHeight) / 2 : position.startsWith('top') ? padding : height - padding - markHeight };
}
export function renderBatchImage(canvas: HTMLCanvasElement, image: HTMLImageElement, options: BatchOptions, logo?: HTMLImageElement | null) {
  const size = batchImageDimensions(image.naturalWidth, image.naturalHeight, options.maxEdge);
  canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Przeglądarka nie obsługuje przetwarzania obrazu.');
  if (options.format === 'jpeg') { context.fillStyle = /^#[\da-f]{6}$/i.test(options.background) ? options.background : '#ffffff'; context.fillRect(0, 0, size.width, size.height); }
  context.drawImage(image, 0, 0, size.width, size.height);
  const markSize = Math.max(5, Math.min(35, options.size)) / 100;
  context.save(); context.globalAlpha = Math.max(0, Math.min(100, options.opacity)) / 100;
  if (options.watermark === 'logo' && logo) {
    const scale = Math.min(size.width * markSize / logo.naturalWidth, size.height * 0.35 / logo.naturalHeight);
    const width = logo.naturalWidth * scale, height = logo.naturalHeight * scale;
    const position = watermarkRect(size.width, size.height, width, height, options.position);
    context.drawImage(logo, position.x, position.y, width, height);
  }
  if (options.watermark === 'text' && options.text.trim()) {
    let font = Math.max(8, Math.min(size.width, size.height) * markSize * 0.5);
    const text = options.text.slice(0, 80);
    context.font = `700 ${font}px Arial`;
    const available = size.width * 0.86;
    if (context.measureText(text).width > available) { font *= available / context.measureText(text).width; context.font = `700 ${font}px Arial`; }
    const width = context.measureText(text).width, height = font * 1.25;
    const position = watermarkRect(size.width, size.height, width, height, options.position);
    context.textBaseline = 'top'; context.fillStyle = /^#[\da-f]{6}$/i.test(options.color) ? options.color : '#ffffff';
    context.shadowBlur = Math.max(1, font * 0.12); context.shadowColor = '#000000'; context.shadowOffsetY = 1;
    context.fillText(text, position.x, position.y);
  }
  context.restore(); return size;
}

export async function encodeBatchCanvas(canvas: HTMLCanvasElement, options: BatchOptions) {
  const mime = batchMime(options.format);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Nie udało się zapisać obrazu.')), mime, Math.max(0.3, Math.min(1, options.quality / 100))));
  if (blob.type !== mime) throw new Error('Ta przeglądarka nie obsługuje wybranego formatu eksportu. Wybierz PNG lub JPG.');
  return blob;
}
