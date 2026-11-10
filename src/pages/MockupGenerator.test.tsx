import { Blob as NodeBlob } from 'node:buffer';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { unzipSync } from 'fflate';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import MockupGenerator from './MockupGenerator';

const mocks = vi.hoisted(() => ({ save: vi.fn(), decode: vi.fn(), png: vi.fn() }));
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/mockup/mockupTemplates', () => ({
  MOCKUP_CATEGORIES: ['Elektronika', 'Merch'],
  MOCKUPS: [
    { id: 'phone', label: 'Telefon', category: 'Elektronika', canvasW: 500, canvasH: 900, bgColor: '#fff', imageArea: { x: 0, y: 0, w: 400, h: 800 }, draw: vi.fn() },
    { id: 'shirt', label: 'Koszulka', category: 'Merch', canvasW: 700, canvasH: 800, bgColor: '#fff', imageArea: { x: 10, y: 20, w: 300, h: 300 }, draw: vi.fn() },
    { id: 'mug', label: 'Kubek', category: 'Merch', canvasW: 600, canvasH: 700, bgColor: '#fff', imageArea: { x: 0, y: 0, w: 300, h: 200 }, draw: vi.fn() },
  ],
}));
vi.mock('@/lib/localDesignExport', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/localDesignExport')>(),
  decodeLocalImage: mocks.decode,
  canvasPng: mocks.png,
  saveLocalBlob: mocks.save,
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('exports only selected mockups with the current fit and preserves the single preview', async () => {
  const image = { naturalWidth: 400, naturalHeight: 200 };
  const drawImage = vi.fn();
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:source', revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(), fillText: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), drawImage,
  } as unknown as CanvasRenderingContext2D);
  mocks.decode.mockResolvedValue(image);
  mocks.png.mockImplementation(async (canvas: HTMLCanvasElement) => new NodeBlob([`${canvas.width}x${canvas.height}`]));

  render(<MemoryRouter><MockupGenerator /></MemoryRouter>);
  const download = screen.getByRole('button', { name: 'Pobierz paczkę ZIP' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Telefon' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Koszulka' }));
  expect(download).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Wgraj grafikę do mockupów'), { target: { files: [new File(['image'], 'logo.png', { type: 'image/png' })] } });
  const fit = await screen.findByLabelText('Dopasowanie grafiki');
  fireEvent.change(fit, { target: { value: 'cover' } });
  drawImage.mockClear();
  fireEvent.click(download);
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  const [blob, name] = mocks.save.mock.calls[0];
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  expect(name).toBe('paczka-mockupow.zip');
  expect(Object.keys(entries)).toEqual(['mockup-phone.png', 'mockup-shirt.png']);
  expect(new TextDecoder().decode(entries['mockup-shirt.png'])).toBe('700x800');
  expect(drawImage.mock.calls).toEqual([[image, -600, 0, 1600, 800], [image, -140, 20, 600, 300]]);
  expect(screen.getByRole('img', { name: 'Podgląd mockupu: Telefon' })).toHaveAttribute('width', '500');
});
