export const PANORAMA_FORMATS = [
  { label: 'Pion 4:5', width: 1080, height: 1350 },
  { label: 'Kwadrat 1:1', width: 1080, height: 1080 },
] as const;

export function panoramaCrop(sourceWidth: number, sourceHeight: number, width: number, height: number, horizontal: number, vertical: number) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;
  return {
    width: scaledWidth,
    height: scaledHeight,
    x: (width - scaledWidth) * horizontal / 100,
    y: (height - scaledHeight) * vertical / 100,
  };
}
