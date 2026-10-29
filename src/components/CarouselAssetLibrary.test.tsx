import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CarouselAssetLibrary } from './CarouselAssetLibrary';
import { vpsFetch, vpsPublicFetch } from '@/lib/vpsApi';
const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/lib/vpsApi', () => ({ vpsFetch: vi.fn(), vpsPublicFetch: vi.fn() }));
vi.mock('@/lib/badgeCatalog', () => ({ BADGE_CATALOG: [
  { id: 'hidden', name: 'Ukryty', description: '', category: 'Promocje', src: '/hidden.png' },
  { id: 'available', name: 'Dostępny', description: '', category: 'Promocje', src: '/available.png' },
  { id: 'paid', name: 'Płatny', description: '', category: 'Promocje', src: '/paid.png' },
] }));
const badges = { ok: true, hiddenKeys: ['hidden'], access: [{ badge_key: 'paid', package_id: 'pack' }], purchasedPackageIds: [] };
const onImage = vi.fn(), onEmoji = vi.fn(), onClose = vi.fn();
const props = { onImage, onEmoji, onClose, canAddElement: true, canAddImage: true };
const open = (source: 'gallery' | 'badges' | 'emoji' | 'icons') => render(<MemoryRouter><CarouselAssetLibrary {...props} source={source}/></MemoryRouter>);
beforeEach(() => { localStorage.clear(); auth.user = null; vi.mocked(vpsPublicFetch).mockResolvedValue(badges); onImage.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('requires login for personal graphics and never requests another user gallery', async () => {
  await act(async () => { open('gallery'); }); expect(screen.getByRole('link', { name: 'Zaloguj się' })).toHaveAttribute('href', '/auth?returnTo=/tools/carousel');
  expect(vpsFetch).not.toHaveBeenCalled();
});
it('loads only the authenticated generated gallery and lets the user choose how to insert it', async () => {
  auth.user = { id: 'self' }; vi.mocked(vpsFetch).mockResolvedValue({ ok: true, graphics: [{ id: 'own', prompt: 'Mój lis', signedUrl: '/signed.png' }] });
  open('gallery'); await screen.findByRole('button', { name: 'Wstaw grafikę: Mój lis' });
  expect(vpsFetch).toHaveBeenCalledWith('/gallery?filter=generated&limit=200', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  fireEvent.change(screen.getByLabelText('Jak wstawić grafikę?'), { target: { value: 'background' } });
  fireEvent.click(screen.getByRole('button', { name: 'Wstaw grafikę: Mój lis' }));
  await waitFor(() => expect(onImage).toHaveBeenCalledWith(expect.objectContaining({ id: 'own', src: '/signed.png' }), 'background', expect.any(AbortSignal)));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});
it.each([false, true])('honors badge hiding and package restrictions for signed-in=%s', async signedIn => {
  if (signedIn) { auth.user = { id: 'self' }; vi.mocked(vpsFetch).mockResolvedValue(badges); }
  open('badges'); await screen.findByRole('button', { name: 'Wstaw badge: Dostępny' });
  expect(screen.queryByRole('button', { name: 'Wstaw badge: Ukryty' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Wstaw badge: Płatny' })).toBeDisabled();
  expect(signedIn ? vpsFetch : vpsPublicFetch).toHaveBeenCalledWith('/assets/badges/library', expect.objectContaining({ cache: 'no-store' }));
});
it('keeps the badge library empty on error and offers a retry', async () => {
  vi.mocked(vpsPublicFetch).mockRejectedValueOnce(new Error('Brak połączenia')); open('badges');
  expect(await screen.findByRole('alert')).toHaveTextContent('Brak połączenia'); expect(screen.queryByRole('button', { name: 'Wstaw badge: Dostępny' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' })); await screen.findByRole('button', { name: 'Wstaw badge: Dostępny' });
});
it('searches emoji in Polish and inserts the actual character without an API request for guests', async () => {
  await act(async () => { open('emoji'); }); fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ogień' } });
  fireEvent.click(screen.getByRole('button', { name: 'Wstaw emoji 🔥' })); expect(onEmoji).toHaveBeenCalledWith('🔥'); expect(onClose).toHaveBeenCalled(); expect(vpsFetch).not.toHaveBeenCalled();
});
it('keeps photo and background available after the movable image limit is reached', async () => {
  auth.user = { id: 'self' }; vi.mocked(vpsFetch).mockResolvedValue({ graphics: [{ id: 'own', prompt: 'Mój lis', signedUrl: '/signed.png' }] });
  render(<MemoryRouter><CarouselAssetLibrary {...props} canAddImage={false} source="gallery"/></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Wstaw grafikę: Mój lis' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Jak wstawić grafikę?'), { target: { value: 'photo' } }); expect(screen.getByRole('button', { name: 'Wstaw grafikę: Mój lis' })).toBeEnabled();
});

it.each([false, true])('opens free icons without an account API call, signed-in=%s', async signedIn => {
  if (signedIn) auth.user = { id: 'self' };
  await act(async () => { open('icons'); });
  fireEvent.change(screen.getByRole('textbox', { name: 'Szukaj ikon do karuzeli' }), { target: { value: 'automatyzacja' } });
  expect(screen.getByRole('button', { name: 'Wstaw ikonę: Automatyzacja' })).toBeEnabled();
  expect(vpsFetch).not.toHaveBeenCalled(); expect(vpsPublicFetch).not.toHaveBeenCalled();
});
it('keeps icon insertion disabled at the custom image limit', async () => {
  await act(async () => { render(<MemoryRouter><CarouselAssetLibrary {...props} canAddImage={false} source="icons"/></MemoryRouter>); });
  expect(screen.getAllByRole('button', { name: /^Wstaw ikonę:/ }).every(button => button.hasAttribute('disabled'))).toBe(true);
});
it('filters favorite badges after server hiding and package restrictions', async () => {
  localStorage.setItem('kreator-favorites-badges-v1', JSON.stringify(['hidden', 'paid']));
  open('badges'); await screen.findByRole('button', { name: 'Wstaw badge: Dostępny' });
  fireEvent.click(screen.getByRole('button', { name: 'Ulubione badge’e' }));
  expect(screen.queryByRole('button', { name: 'Wstaw badge: Ukryty' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Wstaw badge: Dostępny' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Wstaw badge: Płatny' })).toBeDisabled();
});
