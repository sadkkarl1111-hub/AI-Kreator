import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { unzipSync } from 'fflate';
import FreePhotoTools from './FreePhotoTools';

vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
const ctx = { drawImage: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), roundRect: vi.fn(), clip: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() };
let saved: Blob[];
beforeEach(() => {
  saved = [];
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('Image', class { naturalWidth = 101; naturalHeight = 80; src = ''; decode = async () => {}; });
  vi.stubGlobal('URL', { createObjectURL: vi.fn((value: Blob) => { if (value.type === 'application/zip') saved.push(value); return 'blob:test'; }), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) { callback(new NodeBlob(['png'], { type: 'image/png' }) as unknown as Blob); });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  Object.values(ctx).filter(vi.isMockFunction).forEach(fn => fn.mockClear());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function open(mode: 'rounded' | 'frame' | 'tiles') {
  render(<MemoryRouter><FreePhotoTools mode={mode} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Wybierz zdjęcie'), { target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] } });
  return await screen.findByLabelText('Podgląd wyniku') as HTMLCanvasElement;
}
it('clips a centered circular crop and exports transparent PNG without painting a background', async () => {
  const canvas = await open('rounded');
  fireEvent.click(screen.getByLabelText('Wytnij w koło'));
  expect(canvas.width).toBe(80); expect(canvas.height).toBe(80);
  expect(ctx.arc).toHaveBeenLastCalledWith(40, 40, 40, 0, Math.PI * 2);
  expect(ctx.drawImage).toHaveBeenLastCalledWith(expect.anything(), -10.5, 0);
  expect(ctx.fillRect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Pobierz PNG' }));
  await waitFor(() => expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png'));
});
it('adds margins to the output canvas for the frame', async () => {
  const canvas = await open('frame');
  expect(canvas.width).toBe(121); expect(canvas.height).toBe(100);
  expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 121, 100);
});
it('exports every tile into ZIP using the image rather than the preview grid', async () => {
  await open('tiles');
  ctx.drawImage.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Pobierz kafelki ZIP' }));
  await waitFor(() => expect(saved).toHaveLength(1));
  const files = unzipSync(new Uint8Array(await saved[0].arrayBuffer()));
  expect(Object.keys(files)).toHaveLength(9);
  expect(files['kafelek-09-wiersz-3-kolumna-3.png']).toBeDefined();
  const calls = ctx.drawImage.mock.calls;
  expect(calls).toHaveLength(9);
  expect(calls[0].slice(1)).toEqual([0, 0, 34, 27, 0, 0, 34, 27]);
  expect(calls[8].slice(1)).toEqual([67, 53, 34, 27, 0, 0, 34, 27]);
});
