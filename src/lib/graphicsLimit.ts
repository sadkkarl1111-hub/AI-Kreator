import { vpsFetch } from '@/lib/vpsApi';

export const MAX_SAVED_GRAPHICS = 50;

type SaveGraphicInput = {
  userId: string;
  dataUrl: string;
  prompt: string;
  style: string;
  type: string;
  dimensions?: string | null;
};

type SaveGraphicResponse = {
  ok: boolean;
  fileName: string;
  trimmedCount: number;
};

export function getTrimmedGraphicsMessage(trimmedCount: number): string | null {
  if (trimmedCount <= 0) return null;

  const noun =
    trimmedCount === 1
      ? 'najstarsza grafike'
      : trimmedCount < 5
        ? 'najstarsze grafiki'
        : 'najstarszych grafik';

  return `Limit galerii to ${MAX_SAVED_GRAPHICS}. Automatycznie usunieto ${trimmedCount} ${noun}.`;
}

export async function saveGraphicToGallery({
  userId: _userId,
  dataUrl,
  prompt,
  style,
  type,
  dimensions = null,
}: SaveGraphicInput): Promise<{ fileName: string; trimmedCount: number }> {
  const response = await vpsFetch<SaveGraphicResponse>('/gallery/save', {
    method: 'POST',
    body: JSON.stringify({
      dataUrl,
      prompt,
      style,
      type,
      dimensions,
    }),
  });

  return {
    fileName: response.fileName,
    trimmedCount: response.trimmedCount ?? 0,
  };
}
