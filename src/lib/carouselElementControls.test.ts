import { describe, expect, it } from 'vitest';
import { canDuplicateCarouselSticker, carouselElementToolbarPosition, duplicateCarouselSticker } from './carouselElementControls';
import { createCarouselSticker, validateStickers } from './carouselStickers';
const item = () => createCarouselSticker('arrow-right', '#aa3377', 50, 50)!;
describe('contextual carousel actions', () => {
  it('duplicates an independent, visible, unlocked element while sharing its image', () => {
    const original = { ...item(), kind: 'custom', x: 99, y: 99, locked: true, hidden: true, layer: 'back' as const, motion: 'wiggle' as const, asset: { data: 'data:image/png;base64,YQ==', name: 'Logo' } };
    const copy = duplicateCarouselSticker([original], original.id)!;
    expect(copy).toMatchObject({ x: 100, y: 100, locked: false, hidden: false, layer: 'back', motion: 'wiggle' });
    expect(copy.id).not.toBe(original.id); expect(copy.asset).toBe(original.asset); expect(original).toMatchObject({ x: 99, locked: true, hidden: true });
    expect(validateStickers([original, copy])).toHaveLength(2);
  });
  it('enforces total/image limits and rejects stale selections', () => {
    const elements = Array.from({ length: 16 }, item);
    expect(canDuplicateCarouselSticker(elements, elements[0].id)).toBe(false);
    expect(duplicateCarouselSticker(elements, elements[0].id)).toBeNull();
    const custom = elements.slice(0, 8).map(element => ({ ...element, kind: 'custom' }));
    expect(canDuplicateCarouselSticker(custom, custom[0].id)).toBe(false);
    expect(canDuplicateCarouselSticker([...custom, elements[8]], elements[8].id)).toBe(true);
    expect(duplicateCarouselSticker(elements.slice(0, 1), 'missing')).toBeNull();
  });
});
describe('floating toolbar placement', () => {
  const stage = { left: 100, top: 200, width: 800, height: 600 }, canvas = { left: 110, top: 210, width: 780, height: 580 }, toolbar = { width: 350, height: 46 };
  it('uses the actual letterboxed image and follows the rotated selection', () => {
    const normal = carouselElementToolbarPosition(canvas, stage, 1080, 1350, item(), toolbar, 900)!;
    expect(normal.left).toBe(225); expect(normal.top).toBeCloseTo(205.443, 2);
    const rotated = carouselElementToolbarPosition(canvas, stage, 1080, 1350, { ...item(), rotation: 45 }, toolbar, 900)!;
    expect(rotated.left).toBe(normal.left); expect(rotated.top).toBeLessThan(normal.top);
  });
  it('places controls below a top-edge object and clamps both horizontal edges', () => {
    const top = carouselElementToolbarPosition(canvas, stage, 1080, 1350, { ...item(), x: 0, y: 0 }, toolbar, 900)!;
    expect(top.top).toBeGreaterThan(10); expect(top.left).toBeGreaterThanOrEqual(6);
    const right = carouselElementToolbarPosition(canvas, stage, 1080, 1350, { ...item(), x: 100, y: 100, size: 60, rotation: 45 }, toolbar, 900)!;
    expect(right.left + toolbar.width).toBeLessThanOrEqual(stage.width - 6); expect(right.top + toolbar.height).toBeLessThanOrEqual(stage.height - 6);
  });
  it('keeps a wrapped mobile toolbar visible and rejects offscreen or empty canvases', () => {
    const mobileStage = { left: 20, top: 320, width: 280, height: 192 }, mobileCanvas = { left: 32, top: 332, width: 256, height: 168 }, tools = { width: 250, height: 86 };
    const position = carouselElementToolbarPosition(mobileCanvas, mobileStage, 1080, 1350, item(), tools, 568)!;
    expect(position.left).toBeGreaterThanOrEqual(6); expect(position.left + tools.width).toBeLessThanOrEqual(274); expect(position.top + tools.height).toBeLessThanOrEqual(186);
    expect(carouselElementToolbarPosition(canvas, { ...stage, top: 1000 }, 1080, 1350, item(), toolbar, 568)).toBeNull();
    expect(carouselElementToolbarPosition({ ...canvas, width: 0 }, stage, 1080, 1350, item(), toolbar, 900)).toBeNull();
  });
});
