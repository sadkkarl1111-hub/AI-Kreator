import { decodeLocalImage, readLocalDesignImage } from './localDesignExport';
import type { CarouselDocument } from './carouselHistory';
import type { SlideSticker } from './carouselStickers';
import type { ParsedGif } from 'gifuct-js';
export type StickerImage = { width: number; height: number; duration: number; frames: { image: CanvasImageSource; delay: number }[] };
export type StickerImages = Map<string, StickerImage>;
const cache = new Map<string, Promise<StickerImage>>();
export const isStickerAnimated = (sticker: SlideSticker) => !sticker.hidden && (sticker.motion !== 'none' || sticker.asset?.data.startsWith('data:image/gif;'));
export function gifFrameAt(asset: StickerImage, time: number) {
  let position = ((time % asset.duration) + asset.duration) % asset.duration;
  for (const frame of asset.frames) { if (position < frame.delay) return frame.image; position -= frame.delay; }
  return asset.frames[0].image;
}
export function checkGifLimits(gif: ParsedGif) {
  const frames = gif.frames.filter(frame => 'image' in frame);
  const { width, height } = gif.lsd;
  if (gif.header.signature !== 'GIF' || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 800 || height > 800 || frames.length < 1 || frames.length > 40 || width * height * frames.length > 8_000_000) throw new Error('GIF może mieć do 800 px na krawędzi i 40 klatek. Wybierz mniejszą animację.');
  let duration = 0;
  for (const frame of frames) {
    const dims = frame.image.descriptor;
    if (![dims.width, dims.height, dims.left, dims.top, frame.image.data.minCodeSize].every(Number.isInteger) || dims.width < 1 || dims.height < 1 || dims.left < 0 || dims.top < 0 || dims.left + dims.width > width || dims.top + dims.height > height || frame.image.data.minCodeSize < 2 || frame.image.data.minCodeSize > 8) throw new Error('GIF ma niepoprawne wymiary lub dane klatki.');
    duration += Math.max(20, (frame.gce?.delay || 10) * 10);
  }
  if (duration > 8000) throw new Error('GIF może trwać maksymalnie 8 sekund.');
  return { width, height, duration, frames };
}
const createCanvas = (width: number, height: number) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; };
async function decodeAsset(source: string): Promise<StickerImage> {
  if (!/^data:image\/(png|gif);base64,[a-z\d+/]+=*$/i.test(source) || source.length > 3_000_000) throw new Error('Niepoprawny obraz naklejki.');
  const bytes = Uint8Array.from(atob(source.slice(source.indexOf(',') + 1)), char => char.charCodeAt(0));
  if (source.startsWith('data:image/png;')) {
    if (bytes.length < 24 || bytes[0] !== 137 || String.fromCharCode(...bytes.slice(1, 4)) !== 'PNG') throw new Error('Niepoprawny plik PNG.');
    const header = new DataView(bytes.buffer); const width = header.getUint32(16), height = header.getUint32(20);
    if (!width || !height || width > 800 || height > 800) throw new Error('Naklejka PNG w projekcie może mieć maksymalnie 800 px na krawędzi.');
    const image = await decodeLocalImage(source);
    return { width: image.naturalWidth, height: image.naturalHeight, duration: 100, frames: [{ image, delay: 100 }] };
  }
  const { parseGIF, decompressFrame } = await import('gifuct-js');
  const gif = parseGIF(bytes.buffer), limits = checkGifLimits(gif);
  const composite = createCanvas(limits.width, limits.height), context = composite.getContext('2d', { willReadFrequently: true })!;
  const frames: StickerImage['frames'] = [];
  const scale = Math.min(1, 256 / Math.max(limits.width, limits.height));
  const background = gif.gct?.[gif.lsd.backgroundColorIndex];
  const fillBackground = (x: number, y: number, width: number, height: number) => { if (background) { context.fillStyle = `rgb(${background.join(',')})`; context.fillRect(x, y, width, height); } };
  if (!limits.frames[0].gce?.extras.transparentColorGiven) fillBackground(0, 0, limits.width, limits.height);
  for (const frame of limits.frames) {
    const decoded = decompressFrame(frame, gif.gct, true), { dims } = decoded;
    const previous = decoded.disposalType === 3 ? context.getImageData(0, 0, limits.width, limits.height) : null;
    const patch = createCanvas(dims.width, dims.height); patch.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(decoded.patch), dims.width, dims.height), 0, 0);
    context.drawImage(patch, dims.left, dims.top);
    const image = createCanvas(Math.max(1, Math.round(limits.width * scale)), Math.max(1, Math.round(limits.height * scale)));
    image.getContext('2d')!.drawImage(composite, 0, 0, image.width, image.height);
    frames.push({ image, delay: Math.max(20, decoded.delay || 100) }); patch.width = 1; patch.height = 1;
    if (decoded.disposalType === 2) { context.clearRect(dims.left, dims.top, dims.width, dims.height); if (decoded.transparentIndex === undefined) fillBackground(dims.left, dims.top, dims.width, dims.height); }
    if (previous) context.putImageData(previous, 0, 0);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return { width: limits.width, height: limits.height, duration: limits.duration, frames };
}
export function loadStickerAsset(source: string) {
  const previous = cache.get(source);
  if (previous) { cache.delete(source); cache.set(source, previous); return previous; }
  const promise = decodeAsset(source).catch(error => { cache.delete(source); throw error; });
  cache.set(source, promise); while (cache.size > 8) cache.delete(cache.keys().next().value!);
  return promise;
}
export async function loadStickerImages(stickers: SlideSticker[] = []): Promise<StickerImages> {
  const images: StickerImages = new Map();
  for (const sticker of stickers) if (sticker.asset && !images.has(sticker.asset.data)) images.set(sticker.asset.data, await loadStickerAsset(sticker.asset.data));
  return images;
}
export async function readStickerFile(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Wybierz obraz PNG, JPG, WebP lub GIF.');
  if (file.size > (file.type === 'image/gif' ? 2_000_000 : 4_000_000)) throw new Error('Obraz może mieć do 4 MB, a GIF do 2 MB.');
  const data = file.type !== 'image/gif' ? (await readLocalDesignImage(file, 600)).dataUrl : await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Nie udało się odczytać naklejki.')); reader.readAsDataURL(file); });
  await loadStickerAsset(data);
  return { data, name: file.name.slice(0, 100) };
}
export async function validateCarouselAssets(project: CarouselDocument) {
  const images = new Set([project.design.logo, project.design.backgroundImage, ...project.slides.map(slide => slide.image)].filter(Boolean));
  for (const source of images) { const image = await decodeLocalImage(source!); if (image.naturalWidth > 2000 || image.naturalHeight > 2000) throw new Error('Obrazy w projekcie przekraczają dozwolony rozmiar.'); }
  for (const slide of project.slides) await loadStickerImages(slide.stickers);
}
