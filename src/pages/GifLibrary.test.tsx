import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import GifLibrary from './GifLibrary';

vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
const openLibrary = () => render(<MemoryRouter><GifLibrary /></MemoryRouter>);
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('searches Polish text without diacritics, combines filters and recovers from no results', () => {
  openLibrary();
  fireEvent.change(screen.getByRole('textbox', { name: 'Szukaj GIF-ów' }), { target: { value: 'dzien dobry' } });
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'Dzień dobry!' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Reakcje' }));
  expect(screen.queryAllByRole('article')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Pokaż wszystkie GIF-y' }));
  expect(screen.getAllByRole('article')).toHaveLength(18);
  expect(screen.getByRole('textbox', { name: 'Szukaj GIF-ów' })).toHaveValue('');
});

it('copies a public GIF URL, not the gallery page or a temporary blob', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  openLibrary();
  fireEvent.click(screen.getByRole('button', { name: 'Kopiuj link: Dzięki!' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/gifs/v1/dzieki.gif`));
  expect(await screen.findByText(/Link do „Dzięki!” skopiowany/)).toBeVisible();
});

it.each(['denied', 'unavailable'])('offers a selectable link when clipboard is %s', async reason => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: reason === 'denied' ? { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } : undefined });
  openLibrary();
  fireEvent.click(screen.getByRole('button', { name: 'Kopiuj link: Hej!' }));
  expect(await screen.findByRole('dialog')).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Link do GIF-a' })).toHaveValue(`${window.location.origin}/gifs/v1/hej.gif`);
  expect(screen.queryByText(/skopiowany/)).not.toBeInTheDocument();
});

it('pauses previews for reduced motion while downloads keep their animated format', () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
  openLibrary();
  const preview = screen.getByAltText('Ilustrowana reakcja: Hej!');
  expect(preview).toHaveAttribute('src', '/gifs/v1/hej.png');
  const download = screen.getByRole('link', { name: 'Pobierz GIF: Hej!' });
  expect(download).toHaveAttribute('href', '/gifs/v1/hej.gif');
  expect(download).toHaveAttribute('download', 'ai-kreator-hej.gif');
  fireEvent.click(screen.getByRole('button', { name: 'Odtwarzaj podglądy' }));
  expect(preview).toHaveAttribute('src', '/gifs/v1/hej.gif');
  fireEvent.click(screen.getByRole('button', { name: 'Zatrzymaj podglądy' }));
  expect(preview).toHaveAttribute('src', '/gifs/v1/hej.png');
});
