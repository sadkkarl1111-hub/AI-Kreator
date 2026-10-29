export function saveLocalBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function canvasPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Nie udało się zapisać grafiki.')), 'image/png'));
}

export async function decodeLocalImage(url: string) {
  const image = new Image(); image.src = url;
  try { await image.decode(); } catch { throw new Error('Nie udało się odczytać obrazu. Plik może być uszkodzony.'); }
  return image;
}

export async function readLocalDesignImage(file: File, maxEdge?: number) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Wybierz PNG, JPG lub WebP.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Plik może mieć maksymalnie 12 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = await decodeLocalImage(url);
    if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Obraz może mieć maksymalnie 40 megapikseli.');
    const scale = maxEdge ? Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight)) : 1;
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d'); if (!context) throw new Error('Nie udało się odczytać obrazu.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), width: image.naturalWidth, height: image.naturalHeight };
  } finally { URL.revokeObjectURL(url); }
}

export function fitImageRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, mode: 'cover' | 'contain') {
  const scale = (mode === 'cover' ? Math.max : Math.min)(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale, height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height, scale };
}
