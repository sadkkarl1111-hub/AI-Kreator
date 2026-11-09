import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ShopPhotoAudit from './ShopPhotoAudit';

const mocks = vi.hoisted(() => ({ decode: vi.fn() }));
vi.mock('@/components/LocalSvgTool', () => ({ LocalSvgTool: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/lib/localDesignExport', () => ({ decodeLocalImage: mocks.decode }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('reports dimension, ratio and weight failures independently and updates results when the rules change', async () => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });
  mocks.decode.mockResolvedValueOnce({ naturalWidth: 1600, naturalHeight: 1600 }).mockResolvedValueOnce({ naturalWidth: 600, naturalHeight: 900 });
  render(<ShopPhotoAudit />);
  fireEvent.change(screen.getByLabelText(/Wybierz paczkę zdjęć/), { target: { files: [
    new File(['photo'], 'ok.png', { type: 'image/png' }),
    new File([new Uint8Array(3000)], 'popraw.png', { type: 'image/png' }),
  ] } });
  fireEvent.change(screen.getByLabelText('Maks. rozmiar pliku (KB)'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sprawdź zdjęcia' }));
  const results = await screen.findByRole('region', { name: 'Wyniki kontroli' });
  expect(within(results).getByText('Zgodne 1 z 2 zdjęć')).toBeInTheDocument();
  expect(within(results).getByText(/Za małe wymiary/)).toBeInTheDocument();
  expect(within(results).getByText(/Inne proporcje/)).toBeInTheDocument();
  expect(within(results).getByText(/Za duży plik/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Proporcje zdjęcia'), { target: { value: '' } });
  expect(within(results).queryByText(/Inne proporcje/)).not.toBeInTheDocument();
  expect(mocks.decode).toHaveBeenCalledTimes(2);
});
