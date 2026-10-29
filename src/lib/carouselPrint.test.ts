import { describe, expect, it } from 'vitest';
import { fitDesignText, wrapDesignText } from './carouselDesign';
import { fitImageRect } from './localDesignExport';
import { defaultPrintOptions, printGeometry, printImagePlacement, printPdfBoxes } from './printDesign';

describe('carousel layout', () => {
  it('wraps words, newlines and long unbroken text without losing Polish characters', () => {
    const input = 'Żółć gęślą\nDługiwyrazbezspacji';
    const lines = wrapDesignText(input, 6, text => Array.from(text).length);
    expect(lines.every(line => Array.from(line).length <= 6)).toBe(true);
    expect(lines.join('').replace(/\s/g, '')).toBe(input.replace(/\s/g, ''));
    expect(lines).toContain('Żółć');
  });
  it('fits text by reducing type size and explicitly reports overflow instead of exporting a clipped slide', () => {
    const measure = (text: string, size: number) => text.length * size * 0.6;
    const fitted = fitDesignText('Przykład '.repeat(12), 400, 180, 50, 20, measure);
    expect(fitted.fits).toBe(true); expect(fitted.size).toBeLessThan(50);
    expect(fitDesignText('Tekst '.repeat(500), 200, 60, 40, 24, measure).fits).toBe(false);
  });
});

describe('physical print geometry', () => {
  it('adds separate bleed and crop-mark space around the trimmed A5 page', () => {
    const geometry = printGeometry(defaultPrintOptions);
    expect(geometry.pageWidth).toBe(166); expect(geometry.pageHeight).toBe(228);
    expect(geometry.inset).toBe(9); expect(geometry.outer).toBe(6);
    expect(geometry.pixelWidth).toBe(Math.round(166 / 25.4 * 300));
    const noMarks = printGeometry({ ...defaultPrintOptions, marks: false });
    expect(noMarks.pageWidth).toBe(154); expect(noMarks.inset).toBe(3);
  });
  it('calculates real source dpi rather than treating an enlarged export as new detail', () => {
    const options = { ...defaultPrintOptions, width: 100, height: 100, bleed: 0, marks: false };
    expect(printImagePlacement(1000, 1000, options).dpi).toBe(254);
    expect(printImagePlacement(1000, 1000, { ...options, dpi: 150 }).dpi).toBe(254);
    const cover = fitImageRect(2000, 1000, 100, 100, 'cover');
    expect(cover.width).toBe(200); expect(cover.x).toBe(-50);
    const contain = fitImageRect(2000, 1000, 100, 100, 'contain');
    expect(contain.height).toBe(50); expect(contain.y).toBe(25);
  });
  it('keeps cover repositioning inside the bleed area, including both extremes', () => {
    for (const offsetX of [-100, 0, 100]) {
      const options = { ...defaultPrintOptions, fit: 'cover' as const, offsetX };
      const rect = printImagePlacement(2000, 500, options), geometry = printGeometry(options);
      expect(rect.x).toBeLessThanOrEqual(0);
      expect(rect.x + rect.width).toBeGreaterThanOrEqual(geometry.bleedWidth - 0.001);
    }
  });
  it('writes TrimBox and BleedBox in PDF points with the correct physical dimensions', () => {
    const boxes = printPdfBoxes(defaultPrintOptions);
    const toMm = (points: number) => points * 25.4 / 72;
    expect(toMm(boxes.trimBox.topRightX - boxes.trimBox.bottomLeftX)).toBeCloseTo(148);
    expect(toMm(boxes.trimBox.topRightY - boxes.trimBox.bottomLeftY)).toBeCloseTo(210);
    expect(toMm(boxes.bleedBox.topRightX - boxes.bleedBox.bottomLeftX)).toBeCloseTo(154);
    expect(boxes.bleedBox.bottomLeftX).toBeLessThan(boxes.trimBox.bottomLeftX);
  });
  it('rejects invalid or excessive dimensions before allocating a large export canvas', () => {
    for (const update of [{ width: 0 }, { height: Infinity }, { bleed: -1 }, { safe: 100 }, { dpi: 600 }, { width: 420, height: 420 }]) {
      expect(() => printGeometry({ ...defaultPrintOptions, ...update })).toThrow();
    }
    expect(() => printGeometry({ ...defaultPrintOptions, width: 420, height: 420, dpi: 150 })).not.toThrow();
  });
});
