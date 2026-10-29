import { describe, expect, it } from 'vitest';
import { defaultVectorOptions, prepareTracePixels, traceDimensions } from './vectorize';
import { traceRaster } from './vectorizeEngine';
import { buildTextEffectSvg, defaultTextEffectOptions, TEXT_EFFECTS } from './textEffects';

const image = (width: number, height: number, pixel: (x: number, y: number) => number[]) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, data };
};

describe('local vectorization', () => {
  it('bounds tracing work and retains aspect ratio instead of enlarging tiny images', () => {
    expect(traceDimensions(2400, 1200, 640)).toEqual({ width: 640, height: 320 });
    expect(traceDimensions(30, 10, 960)).toEqual({ width: 30, height: 10 });
    expect(() => traceDimensions(10000, 10000, 640)).toThrow(/40/);
    expect(() => prepareTracePixels({ width: 1000, height: 1, data: new Uint8ClampedArray(4000) }, defaultVectorOptions)).toThrow();
  });
  it('removes edge-connected white without deleting enclosed white details or mutating the source', () => {
    const raster = image(7, 7, (x, y) => (x >= 2 && x <= 4 && y >= 2 && y <= 4 && !(x === 3 && y === 3)) ? [40, 30, 90, 255] : [255, 255, 255, 255]);
    const prepared = prepareTracePixels(raster, { ...defaultVectorOptions, removeWhite: true });
    expect(prepared.data[3]).toBe(0);
    expect(prepared.data[(3 * 7 + 3) * 4 + 3]).toBe(255);
    expect(raster.data[3]).toBe(255);
  });
  it('retains transparent regions and converts luminance to clean black/white', () => {
    const prepared = prepareTracePixels(image(3, 1, x => [[255, 0, 0, 0], [30, 50, 40, 255], [230, 230, 230, 255]][x]), { ...defaultVectorOptions, monochrome: true });
    expect(Array.from(prepared.data)).toEqual([0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255]);
  });
  it('traces real curves without embedding pixels, keeps original export dimensions and removes transparent paths', () => {
    const raster = image(64, 64, (x, y) => Math.hypot(x - 32, y - 32) < 20 ? [120, 40, 220, 255] : [0, 0, 0, 0]);
    const result = traceRaster({ image: raster, options: defaultVectorOptions, originalWidth: 640, originalHeight: 640 });
    const document = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.documentElement.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(document.documentElement.getAttribute('width')).toBe('640');
    expect(document.querySelector('path')).not.toBeNull();
    expect(result.svg).not.toMatch(/<image|data:|<script|opacity="0"/);
    expect(result.paths).toBeGreaterThan(0);
  });
  it('produces distinct colored regions and rejects an entirely transparent source', () => {
    const result = traceRaster({ image: image(64, 32, x => x < 32 ? [255, 0, 0, 255] : [0, 0, 255, 255]), options: { ...defaultVectorOptions, colors: 2 }, originalWidth: 64, originalHeight: 32 });
    expect(result.svg).toContain('rgb(255,0,0)');
    expect(result.svg).toContain('rgb(0,0,255)');
    expect(() => traceRaster({ image: image(16, 16, () => [0, 0, 0, 0]), options: defaultVectorOptions, originalWidth: 16, originalHeight: 16 })).toThrow(/konturów/);
  });
});

const measure = (text: string, size: number) => Array.from(text).length * size * 0.7;
describe('text effects', () => {
  it('builds valid SVG for all six effects, preserves Polish text and uses optional backgrounds', () => {
    for (const effect of TEXT_EFFECTS) {
      const result = buildTextEffectSvg({ ...defaultTextEffectOptions, text: 'ŻÓŁĆ & ŁĄKA\nDrugi wiersz', effect: effect.id }, measure)!;
      const document = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
      expect(document.querySelector('parsererror')).toBeNull();
      expect(document.querySelector('text')?.textContent).toBe('ŻÓŁĆ & ŁĄKA');
      expect(document.querySelector('rect')).toBeNull();
      expect(result.svg).not.toMatch(/NaN|undefined/);
    }
    expect(buildTextEffectSvg({ ...defaultTextEffectOptions, transparent: false }, measure)!.svg).toContain('<rect');
  });
  it('escapes user content and rejects color, font and effect attribute injection', () => {
    const result = buildTextEffectSvg({ ...defaultTextEffectOptions, text: '<script>&"\u0001', color: 'url(https://bad)', accent: '" onload="bad', font: '"><image/>', effect: 'unknown' }, measure)!;
    expect(result.svg).not.toMatch(/<script|<image|https:|onload/);
    expect(result.svg).not.toContain(String.fromCharCode(1));
    expect(result.svg).toContain('&lt;script&gt;&amp;&quot;');
    expect(new DOMParser().parseFromString(result.svg, 'image/svg+xml').querySelector('parsererror')).toBeNull();
  });
  it('fits a long unbroken line and clamps numeric options to avoid cropping or invalid export', () => {
    const result = buildTextEffectSvg({ ...defaultTextEffectOptions, text: 'W'.repeat(240), size: 9999, spacing: 12, strength: NaN }, measure)!;
    const document = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
    const group = document.querySelector('g')!;
    const size = Number(group.getAttribute('font-size')), spacing = Number(group.getAttribute('letter-spacing'));
    expect(measure('W'.repeat(240), size) + 239 * spacing).toBeLessThanOrEqual(1001);
    expect(result.svg).not.toMatch(/NaN|Infinity/);
    expect(buildTextEffectSvg({ ...defaultTextEffectOptions, text: '\n  ' }, measure)).toBeNull();
  });
});
