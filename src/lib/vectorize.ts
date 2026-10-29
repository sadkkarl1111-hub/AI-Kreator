export type VectorOptions = { colors: number; detail: number; smoothing: number; removeWhite: boolean; monochrome: boolean; threshold: number };
export type RasterData = { width: number; height: number; data: Uint8ClampedArray };
export type VectorRequest = { image: RasterData; options: VectorOptions; originalWidth: number; originalHeight: number };
export type VectorResult = { svg: string; paths: number; width: number; height: number };

export const defaultVectorOptions: VectorOptions = { colors: 8, detail: 640, smoothing: 1, removeWhite: false, monochrome: false, threshold: 160 };

export function traceDimensions(width: number, height: number, maximum: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 40_000_000) throw new Error('Obraz może mieć maksymalnie 40 megapikseli.');
  const edge = [384, 640, 960].includes(maximum) ? maximum : 640;
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Remove only near-white pixels connected to the image edges, preserving white details inside a logo.
export function prepareTracePixels(image: RasterData, options: VectorOptions): RasterData {
  const { width, height } = image;
  if (width < 1 || height < 1 || width > 960 || height > 960 || image.data.length !== width * height * 4) throw new Error('Niepoprawny obraz do wektoryzacji.');
  const data = new Uint8ClampedArray(image.data);
  if (options.removeWhite) {
    const seen = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let start = 0, end = 0;
    const add = (pixel: number) => {
      if (seen[pixel]) return;
      seen[pixel] = 1;
      const offset = pixel * 4;
      if (data[offset + 3] < 32 || (data[offset] >= 232 && data[offset + 1] >= 232 && data[offset + 2] >= 232)) queue[end++] = pixel;
    };
    for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
    for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1); }
    while (start < end) {
      const pixel = queue[start++];
      data[pixel * 4 + 3] = 0;
      if (pixel % width) add(pixel - 1);
      if (pixel % width < width - 1) add(pixel + 1);
      if (pixel >= width) add(pixel - width);
      if (pixel < width * (height - 1)) add(pixel + width);
    }
  }
  const threshold = Math.max(0, Math.min(255, Number(options.threshold) || 0));
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0; }
    else if (options.monochrome) {
      const shade = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722 < threshold ? 0 : 255;
      data[i] = shade; data[i + 1] = shade; data[i + 2] = shade; data[i + 3] = 255;
    } else data[i + 3] = 255;
  }
  return { width, height, data };
}
