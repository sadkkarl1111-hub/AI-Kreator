import { Blob as NodeBlob } from 'node:buffer';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { unzipSync } from 'fflate';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import CarouselPanorama from './CarouselPanorama';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  decode: vi.fn(),
  png: vi.fn(),
  api: vi.fn(),
}));

vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/vpsApi', () => ({ vpsFetch: mocks.api }));
vi.mock('@/lib/localDesignExport', () => ({
  decodeLocalImage: mocks.decode,
  canvasPng: mocks.png,
  saveLocalBlob: mocks.save,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('exports a single continuous crop as three numbered portrait slides without calling AI', async () => {
  const image = { src: 'blob:panorama', naturalWidth: 3240, naturalHeight: 2000 };
  const drawImage = vi.fn();
  const exportedSizes: number[][] = [];
  vi.stubGlobal('URL', { createObjectURL: () => image.src, revokeObjectURL: vi.fn() });
  vi.stubGlobal('Blob', NodeBlob);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, clearRect: vi.fn() } as unknown as CanvasRenderingContext2D);
  mocks.decode.mockResolvedValue(image);
  mocks.png.mockImplementation(async (canvas: HTMLCanvasElement) => {
    exportedSizes.push([canvas.width, canvas.height]);
    return new NodeBlob(['png'], { type: 'image/png' });
  });

  render(<MemoryRouter><CarouselPanorama /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/Wybierz zdjęcie/), { target: { files: [new File(['photo'], 'panorama.png', { type: 'image/png' })] } });
  await screen.findByAltText('Podgląd podziału zdjęcia na slajdy');
  fireEvent.change(screen.getByLabelText('Liczba slajdów'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Przesunięcie kadru w pionie'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pobierz slajdy ZIP' }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());

  const [archive, name] = mocks.save.mock.calls[0];
  expect(name).toBe('karuzela-panoramiczna.zip');
  expect(Object.keys(unzipSync(new Uint8Array(await archive.arrayBuffer())))).toEqual(['slajd-01.png', 'slajd-02.png', 'slajd-03.png']);
  expect(exportedSizes).toEqual([[1080, 1350], [1080, 1350], [1080, 1350]]);
  expect(drawImage.mock.calls).toEqual([
    [image, 0, -650, 3240, 2000],
    [image, -1080, -650, 3240, 2000],
    [image, -2160, -650, 3240, 2000],
  ]);
  expect(mocks.api).not.toHaveBeenCalled();
});
