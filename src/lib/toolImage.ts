import { vpsFetch } from '@/lib/vpsApi';

export type SelectedToolImage = {
  dataUrl: string;
  base64: string;
  mimeType: string;
  source: 'upload' | 'gallery';
  name?: string;
};

export type GalleryToolImage = {
  id: string;
  url: string;
  prompt: string;
};

type ToolGalleryImagesResponse = {
  ok: boolean;
  images: GalleryToolImage[];
};

type ToolImageTransformOptions = {
  maxDimension?: number;
  outputMimeType?: string;
  quality?: number;
};

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Nie udało się załadować obrazu'));
    image.src = src;
  });

  return image;
}

function resizeDimensions(width: number, height: number, maxDimension?: number) {
  if (!maxDimension || Math.max(width, height) <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / Math.max(width, height);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function renderImageToDataUrl(
  image: HTMLImageElement,
  options?: ToolImageTransformOptions,
): { dataUrl: string; mimeType: string } {
  const targetMimeType = options?.outputMimeType || 'image/png';
  const quality = options?.quality ?? 0.92;
  const size = resizeDimensions(image.naturalWidth, image.naturalHeight, options?.maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Nie udało się przygotować obrazu');
  }

  context.drawImage(image, 0, 0, size.width, size.height);

  return {
    dataUrl: canvas.toDataURL(targetMimeType, quality),
    mimeType: targetMimeType,
  };
}

export async function readImageFile(
  file: File,
  maxSizeMb = 20,
  transformOptions?: ToolImageTransformOptions,
): Promise<SelectedToolImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Wybierz plik graficzny');
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`Plik jest za duży (max ${maxSizeMb} MB)`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Nie udało się odczytać pliku'));
    reader.readAsDataURL(file);
  });

  let finalDataUrl = dataUrl;
  let finalMimeType = file.type || 'image/png';

  if (transformOptions) {
    const image = await loadImageElement(dataUrl);
    const rendered = renderImageToDataUrl(image, transformOptions);
    finalDataUrl = rendered.dataUrl;
    finalMimeType = rendered.mimeType;
  }

  return {
    dataUrl: finalDataUrl,
    base64: getBase64FromDataUrl(finalDataUrl),
    mimeType: finalMimeType,
    source: 'upload',
    name: file.name,
  };
}

export function getBase64FromDataUrl(dataUrl: string) {
  const [, base64 = ''] = dataUrl.split(',');
  return base64;
}

export async function loadUserGalleryImages(
  _client: unknown,
  _userId: string,
  limit = 20,
): Promise<GalleryToolImage[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await vpsFetch<ToolGalleryImagesResponse>(`/gallery/tool-images?${params.toString()}`);

  return response.images ?? [];
}

export async function loadImageFromUrlAsDataUrl(
  url: string,
  transformOptions?: ToolImageTransformOptions,
): Promise<SelectedToolImage> {
  const image = await loadImageElement(url);
  const rendered = renderImageToDataUrl(image, transformOptions);

  return {
    dataUrl: rendered.dataUrl,
    base64: getBase64FromDataUrl(rendered.dataUrl),
    mimeType: rendered.mimeType,
    source: 'gallery',
  };
}
