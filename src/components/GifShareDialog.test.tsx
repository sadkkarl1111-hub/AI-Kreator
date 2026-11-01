import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GifShareDialog } from './GifShareDialog';
import { GIF_LIBRARY } from '@/lib/gifLibrary';

const gif = GIF_LIBRARY[0];
const mp4Bytes = new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109]);
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => mp4Bytes.buffer }));
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('offers a downloadable video even when native sharing is unsupported', async () => {
  render(<GifShareDialog gif={gif} onClose={() => {}} />);
  expect(screen.getByRole('link', { name: 'Pobierz animację MP4' })).toHaveAttribute('href', gif.mp4);
  expect(screen.getByLabelText('Podgląd animacji MP4')).toHaveAttribute('src', gif.mp4);
  expect(screen.queryByRole('button', { name: 'Udostępnij plik w aplikacji' })).not.toBeInTheDocument();
});

it('shares the prepared video file without substituting a URL', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn().mockReturnValue(true) });
  render(<GifShareDialog gif={gif} onClose={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Udostępnij plik w aplikacji' }));
  await waitFor(() => expect(share).toHaveBeenCalledOnce());
  const payload = share.mock.calls[0][0];
  expect(Object.keys(payload)).toEqual(['files']);
  expect(payload.files[0]).toBeInstanceOf(File);
  expect(payload.files[0].type).toBe('video/mp4');
  expect(payload.files[0].name).toBe(`ai-kreator-${gif.id}.mp4`);
});

it('reports failed or invalid media instead of presenting HTML as a video', async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode('<html>not video</html>').buffer } as Response);
  render(<GifShareDialog gif={gif} onClose={() => {}} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('nieprawidłowy plik');
  expect(screen.queryByRole('button', { name: 'Udostępnij plik w aplikacji' })).not.toBeInTheDocument();
});

it('does not label a cancelled share as sent', async () => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  render(<GifShareDialog gif={gif} onClose={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Udostępnij plik w aplikacji' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Udostępnij plik w aplikacji' })).not.toBeDisabled());
  expect(screen.queryByText(/Zakończono udostępnianie/)).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
