import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PhotoComparison from './PhotoComparison';

const mocks = vi.hoisted(() => ({ read: vi.fn(), decode: vi.fn(), save: vi.fn(), png: vi.fn() }));
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/lib/localDesignExport', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/localDesignExport')>(),
  readLocalDesignImage: mocks.read,
  decodeLocalImage: mocks.decode,
  saveLocalBlob: mocks.save,
  canvasPng: mocks.png,
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it('compares two photos and exports both in order even when their proportions differ', async () => {
  const before = { src: 'before.png', naturalWidth: 400, naturalHeight: 600 };
  const after = { src: 'after.png', naturalWidth: 1200, naturalHeight: 600 };
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage, fillRect: vi.fn(), fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  mocks.read.mockResolvedValue({ dataUrl: 'data:image/png;base64,AA==' });
  mocks.decode.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
  mocks.png.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));

  render(<MemoryRouter><PhotoComparison /></MemoryRouter>);
  const file = new File(['photo'], 'source.png', { type: 'image/png' });
  const beforeInput = screen.getByLabelText(/Zdjęcie „Przed”/);
  fireEvent.change(beforeInput, { target: { files: [file] } });
  await waitFor(() => expect(beforeInput).toBeEnabled());
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Zdjęcie „Po”/), { target: { files: [file] } });
  const slider = await screen.findByRole('slider', { name: 'Suwak porównania' });
  fireEvent.change(slider, { target: { value: '75' } });
  expect(screen.getByAltText('Zdjęcie przed zmianą')).toHaveStyle({ clipPath: 'inset(0 25% 0 0)' });
  fireEvent.click(screen.getByRole('button', { name: /Pobierz oba zdjęcia/ }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.any(Blob), 'porownanie-przed-i-po.png'));
  expect(drawImage.mock.calls[0]).toEqual([before, 200, 0, 400, 600]);
  expect(drawImage.mock.calls[1]).toEqual([after, 800, 100, 800, 400]);
});
