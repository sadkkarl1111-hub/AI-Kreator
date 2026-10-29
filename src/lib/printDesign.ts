import { fitImageRect } from './localDesignExport';

export type PrintOptions = { width: number; height: number; bleed: number; safe: number; marks: boolean; fit: 'cover' | 'contain'; background: string; dpi: number; offsetX: number; offsetY: number };
export const defaultPrintOptions: PrintOptions = { width: 148, height: 210, bleed: 3, safe: 5, marks: true, fit: 'contain', background: '#ffffff', dpi: 300, offsetX: 0, offsetY: 0 };
export const PRINT_FORMATS = [
  { id: 'a4', name: 'A4', width: 210, height: 297 },
  { id: 'a5', name: 'A5', width: 148, height: 210 },
  { id: 'a6', name: 'A6', width: 105, height: 148 },
  { id: 'card', name: 'Wizytówka', width: 90, height: 50 },
  { id: 'square', name: 'Kwadrat', width: 150, height: 150 },
];

export function printGeometry(options: PrintOptions) {
  for (const value of [options.width, options.height, options.bleed, options.safe, options.dpi]) if (!Number.isFinite(value)) throw new Error('Podaj poprawne wymiary i rozdzielczość.');
  if (options.width < 20 || options.height < 20 || options.width > 420 || options.height > 420) throw new Error('Wymiary po obcięciu muszą mieścić się między 20 a 420 mm.');
  if (options.bleed < 0 || options.bleed > 10 || options.safe < 0 || options.safe > 20 || options.safe * 2 >= Math.min(options.width, options.height)) throw new Error('Sprawdź spady i margines bezpieczeństwa.');
  if (![150, 300].includes(options.dpi)) throw new Error('Wybierz 150 lub 300 dpi.');
  const outer = options.marks ? 6 : 0;
  const inset = outer + options.bleed;
  const pageWidth = options.width + inset * 2, pageHeight = options.height + inset * 2;
  const pixelWidth = Math.round(pageWidth / 25.4 * options.dpi), pixelHeight = Math.round(pageHeight / 25.4 * options.dpi);
  if (pixelWidth * pixelHeight > 24_000_000) throw new Error('Ten format jest zbyt duży dla 300 dpi. Wybierz 150 dpi lub mniejsze wymiary.');
  return { pageWidth, pageHeight, inset, outer, pixelWidth, pixelHeight, bleedWidth: options.width + 2 * options.bleed, bleedHeight: options.height + 2 * options.bleed };
}

export function printImagePlacement(sourceWidth: number, sourceHeight: number, options: PrintOptions) {
  const geometry = printGeometry(options);
  const rect = fitImageRect(sourceWidth, sourceHeight, geometry.bleedWidth, geometry.bleedHeight, options.fit);
  const clamp = (value: number) => Number.isFinite(value) ? Math.max(-100, Math.min(100, value)) : 0;
  if (options.fit === 'cover') {
    rect.x += Math.abs(rect.width - geometry.bleedWidth) / 2 * clamp(options.offsetX) / 100;
    rect.y += Math.abs(rect.height - geometry.bleedHeight) / 2 * clamp(options.offsetY) / 100;
  }
  return { ...rect, dpi: Math.floor(Math.min(sourceWidth / rect.width, sourceHeight / rect.height) * 25.4) };
}

export function renderPrintCanvas(canvas: HTMLCanvasElement, image: HTMLImageElement, options: PrintOptions, preview = false) {
  const geometry = printGeometry(options);
  const scale = preview ? Math.min(1000 / geometry.pageWidth, 1000 / geometry.pageHeight) : options.dpi / 25.4;
  canvas.width = preview ? Math.round(geometry.pageWidth * scale) : geometry.pixelWidth;
  canvas.height = preview ? Math.round(geometry.pageHeight * scale) : geometry.pixelHeight;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Brak obsługi grafiki w przeglądarce.');
  context.scale(canvas.width / geometry.pageWidth, canvas.height / geometry.pageHeight);
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, geometry.pageWidth, geometry.pageHeight);
  context.save(); context.beginPath(); context.rect(geometry.outer, geometry.outer, geometry.bleedWidth, geometry.bleedHeight); context.clip();
  context.fillStyle = /^#[\da-f]{6}$/i.test(options.background) ? options.background : '#ffffff';
  context.fillRect(geometry.outer, geometry.outer, geometry.bleedWidth, geometry.bleedHeight);
  const rect = printImagePlacement(image.naturalWidth, image.naturalHeight, options);
  context.drawImage(image, geometry.outer + rect.x, geometry.outer + rect.y, rect.width, rect.height); context.restore();
  if (options.marks) {
    const left = geometry.inset, right = left + options.width, top = geometry.inset, bottom = top + options.height;
    context.strokeStyle = '#000000'; context.lineWidth = 0.2;
    context.beginPath();
    for (const x of [left, right]) { context.moveTo(x, 1); context.lineTo(x, geometry.outer - 1); context.moveTo(x, geometry.pageHeight - geometry.outer + 1); context.lineTo(x, geometry.pageHeight - 1); }
    for (const y of [top, bottom]) { context.moveTo(1, y); context.lineTo(geometry.outer - 1, y); context.moveTo(geometry.pageWidth - geometry.outer + 1, y); context.lineTo(geometry.pageWidth - 1, y); }
    context.stroke();
  }
  if (preview) {
    context.lineWidth = 0.35; context.setLineDash([1.5, 1]);
    context.strokeStyle = '#9333ea'; context.strokeRect(geometry.inset, geometry.inset, options.width, options.height);
    context.strokeStyle = '#059669'; context.strokeRect(geometry.inset + options.safe, geometry.inset + options.safe, options.width - options.safe * 2, options.height - options.safe * 2);
  }
  return geometry;
}

// jsPDF page box coordinates are PDF points, measured from the bottom-left corner.
export function printPdfBoxes(options: PrintOptions) {
  const geometry = printGeometry(options), point = (mm: number) => mm * 72 / 25.4;
  const box = (inset: number) => ({ bottomLeftX: point(inset), bottomLeftY: point(inset), topRightX: point(geometry.pageWidth - inset), topRightY: point(geometry.pageHeight - inset) });
  return { trimBox: box(geometry.inset), bleedBox: box(geometry.outer) };
}
