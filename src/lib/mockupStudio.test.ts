import { afterEach, expect, it, vi } from 'vitest';
import { artworkRect, DEFAULT_ARTWORK_FRAME, drawStudioMockup, hasStudioMockup, studioViewsFor } from './mockupStudio';
import { MOCKUPS } from '@/components/mockup/mockupTemplates';

afterEach(() => vi.restoreAllMocks());

it('projects artwork and casts a shadow in every supported scene and view', () => {
  const gradient = { addColorStop: vi.fn() };
  const drawImage = vi.fn();
  const transform = vi.fn();
  const context = {
    fillRect: vi.fn(), fill: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
    createRadialGradient: vi.fn(() => gradient), createLinearGradient: vi.fn(() => gradient),
    ellipse: vi.fn(), roundRect: vi.fn(), save: vi.fn(), restore: vi.fn(), clip: vi.fn(), stroke: vi.fn(), drawImage, transform,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const canvas = document.createElement('canvas');
  const image = { naturalWidth: 640, naturalHeight: 480 } as HTMLImageElement;
  const templates = MOCKUPS.filter(template => hasStudioMockup(template.id));
  expect(templates).toHaveLength(13);
  for (const template of templates) {
    const viewTransforms: unknown[][][] = [];
    for (const view of studioViewsFor(template.id)) {
      transform.mockClear();
      drawImage.mockClear();
      context.ellipse.mockClear();
      drawStudioMockup(canvas, template.id, image, 'cover', view.id, 'light');
      const label = `${template.id}/${view.id}`;
      expect(canvas.width, label).toBe(1080);
      expect(context.ellipse, label).toHaveBeenCalled();
      expect(drawImage.mock.calls[0][0], label).toBe(image);
      expect(transform.mock.calls.length, label).toBeGreaterThan(0);
      expect(transform.mock.calls.flat().every(Number.isFinite), label).toBe(true);
      viewTransforms.push([...transform.mock.calls]);
    }
    expect(new Set(viewTransforms.map(calls => JSON.stringify(calls))).size, template.id).toBe(viewTransforms.length);
  }
});

it('fills the screen without letterboxing, and positions the zoomed crop within the screen', () => {
  const image = { naturalWidth: 400, naturalHeight: 300 } as HTMLImageElement;
  expect(artworkRect(image, 200, 400, 'contain', DEFAULT_ARTWORK_FRAME)).toEqual({ x: 0, y: 125, width: 200, height: 150 });
  const cover = artworkRect(image, 200, 400, 'cover', { zoom: 150, horizontal: 100, vertical: -100 });
  expect(cover.width).toBeCloseTo(800);
  expect(cover.height).toBe(600);
  expect(cover.x + cover.width).toBeCloseTo(200);
  expect(Math.abs(cover.y)).toBe(0);
});

it('leaves the scene transparent and draws the contact shadow only when requested', () => {
  const gradient = { addColorStop: vi.fn() };
  const context = {
    fillRect: vi.fn(), fill: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
    createRadialGradient: vi.fn(() => gradient), createLinearGradient: vi.fn(() => gradient),
    ellipse: vi.fn(), roundRect: vi.fn(), save: vi.fn(), restore: vi.fn(), clip: vi.fn(), drawImage: vi.fn(), transform: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const canvas = document.createElement('canvas');
  const image = { naturalWidth: 400, naturalHeight: 300 } as HTMLImageElement;
  drawStudioMockup(canvas, 'iphone', image, 'cover', 'right', 'transparent', DEFAULT_ARTWORK_FRAME, false);
  expect(context.createRadialGradient).not.toHaveBeenCalled();
  expect(context.ellipse).toHaveBeenCalledOnce();
  context.ellipse.mockClear();
  drawStudioMockup(canvas, 'iphone', image, 'cover', 'right', 'transparent', DEFAULT_ARTWORK_FRAME, true);
  expect(context.createRadialGradient).not.toHaveBeenCalled();
  expect(context.ellipse).toHaveBeenCalledTimes(2);
});
