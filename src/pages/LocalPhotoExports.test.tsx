import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Blob as NodeBlob } from 'node:buffer';
import { decompressFrames, parseGIF } from 'gifuct-js';
import PhotoGifMaker from './PhotoGifMaker';
import PhotoRedaction from './PhotoRedaction';

const mocks = vi.hoisted(() => ({ read: vi.fn(), decode: vi.fn(), save: vi.fn(), png: vi.fn() }));
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/lib/localDesignExport', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/localDesignExport')>(),
  readLocalDesignImage: mocks.read,
  decodeLocalImage: mocks.decode,
  saveLocalBlob: mocks.save,
  canvasPng: mocks.png,
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

it('encodes the reordered frames at the selected speed and keeps download available with the preview stopped', async () => {
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:gif', revokeObjectURL: vi.fn() });
  mocks.read.mockImplementation(async (file: File) => ({ dataUrl: file.name }));
  mocks.decode.mockImplementation(async (name: string) => ({ src: name, naturalWidth: 1, naturalHeight: 1 }));
  let pixels = new Uint8ClampedArray(4);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    drawImage: (image: HTMLImageElement) => {
      pixels = image.src === 'red.png' ? new Uint8ClampedArray([255, 0, 0, 255]) : new Uint8ClampedArray([0, 0, 255, 255]);
    },
    getImageData: () => ({ data: pixels }),
  } as unknown as CanvasRenderingContext2D);
  render(<MemoryRouter><PhotoGifMaker /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/Dodaj zdjęcia/), {
    target: { files: ['red.png', 'blue.png'].map(name => new File(['photo'], name, { type: 'image/png' })) },
  });
  await screen.findByText('2. blue.png');
  fireEvent.click(screen.getByRole('button', { name: 'Przesuń klatkę 2 wyżej' }));
  fireEvent.change(screen.getByLabelText('Czas wyświetlania klatki'), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Utwórz GIF' }));
  await screen.findByAltText('Podgląd gotowego GIF-a');
  fireEvent.click(screen.getByRole('button', { name: 'Zatrzymaj podgląd' }));
  expect(screen.queryByAltText('Podgląd gotowego GIF-a')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Pobierz GIF' }));
  const [gif, filename] = mocks.save.mock.calls[0];
  const frames = decompressFrames(parseGIF(await gif.arrayBuffer()), true);
  expect(filename).toBe('animacja-ze-zdjec.gif');
  expect(frames.map(frame => frame.delay)).toEqual([1000, 1000]);
  expect(frames.map(frame => Array.from(frame.patch))).toEqual([[0, 0, 255, 255], [255, 0, 0, 255]]);
});

it('paints opaque redaction rectangles into the exported PNG at source image coordinates', async () => {
  mocks.read.mockResolvedValue({ dataUrl: 'source.png' });
  mocks.decode.mockResolvedValue({ src: 'source.png', naturalWidth: 400, naturalHeight: 200 });
  mocks.png.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  const fillRect = vi.fn();
  const context = { drawImage: vi.fn(), fillRect, fillStyle: '' };
  vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const { container } = render(<MemoryRouter><PhotoRedaction /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/Wybierz zdjęcie/), { target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] } });
  const image = await screen.findByAltText('Zdjęcie z podglądem zasłoniętych obszarów');
  const overlay = image.nextElementSibling as SVGSVGElement;
  expect(container).toContainElement(overlay);
  Object.defineProperty(overlay, 'setPointerCapture', { value: vi.fn() });
  vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 100 } as DOMRect);
  for (const [type, x, y] of [['pointerdown', 100, 70], ['pointerup', 30, 20]] as const) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(overlay, event);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Pobierz PNG' }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(context.fillStyle).toBe('#000000');
  expect(fillRect).toHaveBeenCalledWith(60, 40, 140, 100);
});
