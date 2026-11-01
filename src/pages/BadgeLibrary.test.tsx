import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import BadgeLibrary from './BadgeLibrary';
import { vpsFetch, vpsPublicFetch } from '@/lib/vpsApi';

const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/lib/vpsApi', () => ({ vpsFetch: vi.fn(), vpsPublicFetch: vi.fn() }));
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/badgeCatalog', () => ({ BADGE_CATALOG: [
  { id: 'hidden', name: 'Ukryta grafika', description: 'Ukryta', category: 'Promocje', src: '/hidden.png' },
  { id: 'visible', name: 'Widoczna grafika', description: 'Widoczna', category: 'Promocje', src: '/visible.png' },
  { id: 'paid', name: 'Płatna grafika', description: 'Pakiet', category: 'Promocje', src: '/paid.png' },
] }));

const library = {
  ok: true, hiddenKeys: ['hidden'], badges: [],
  access: [{ badge_key: 'paid', package_id: 'premium' }],
  packages: [{ id: 'premium', label: 'Premium' }], purchasedPackageIds: [],
};
const EditorDestination = () => <p>Edytor AI{useLocation().search}</p>;
const openLibrary = () => render(<MemoryRouter initialEntries={['/tools/badges']}><Routes>
  <Route path="/tools/badges" element={<BadgeLibrary />} />
  <Route path="/tools/badge-editor" element={<EditorDestination />} />
</Routes></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  auth.user = null;
  vi.mocked(vpsPublicFetch).mockResolvedValue(library);
  vi.mocked(vpsFetch).mockResolvedValue(library);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); });

it('combines category, Polish search, style and color and resets all filters', async () => {
  const extra = [
    { id: 'gold', name: 'Gwarancja 30 dni złota', category: 'Gwarancje', description: 'Pieczęć', style: 'Złota pieczęć', color: 'Złoty', src: '/gold.png' },
    { id: 'mint', name: 'Gwarancja 30 dni miętowa', category: 'Gwarancje', description: 'Prosta', style: 'Minimalistyczny', color: 'Miętowy', src: '/mint.png' },
    { id: 'bonus', name: 'Bonus złoty', category: 'Bonusy', description: 'Pieczęć', style: 'Złota pieczęć', color: 'Złoty', src: '/bonus.png' },
    { id: 'hidden-style', name: 'Ukryta nowa', category: 'Bonusy', description: '', style: 'Ukryty styl', color: 'Ukryty kolor', src: '/hidden.png' },
  ];
  vi.mocked(vpsPublicFetch).mockResolvedValue({ ...library, hiddenKeys: ['hidden', 'hidden-style'], badges: extra });
  openLibrary(); await screen.findByText('Gwarancja 30 dni złota');
  expect(screen.queryByRole('option', { name: 'Ukryty styl' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Gwarancje' }));
  fireEvent.change(screen.getByPlaceholderText("Szukaj badge'ów..."), { target: { value: 'gwarancja 30' } });
  fireEvent.change(screen.getByLabelText('Styl badge’ów'), { target: { value: 'Złota pieczęć' } });
  expect(screen.getAllByRole('img')).toHaveLength(1);
  await waitFor(() => expect(screen.getByAltText('Gwarancja 30 dni złota')).toBeVisible());
  fireEvent.change(screen.getByLabelText('Kolor badge’ów'), { target: { value: 'Miętowy' } });
  expect(screen.queryAllByRole('img')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Pokaż wszystkie badge’e' }));
  expect(screen.getAllByRole('img')).toHaveLength(5);
  expect(screen.getByLabelText('Styl badge’ów')).toHaveValue('');
  expect(screen.getByLabelText('Kolor badge’ów')).toHaveValue('');
  expect(screen.queryByAltText('Ukryta nowa')).not.toBeInTheDocument();
});

it.each([false, true])('honors hidden badges and package restrictions for signed-in=%s', async signedIn => {
  if (signedIn) auth.user = { id: 'user' };
  openLibrary();
  await screen.findByText('Widoczna grafika');
  expect(screen.queryByText('Ukryta grafika')).not.toBeInTheDocument();
  const paidCard = screen.getByText('Płatna grafika').parentElement!.parentElement!;
  expect(within(paidCard).getByRole('button', { name: 'Edytuj AI' })).toBeDisabled();
  expect(within(paidCard).getByRole('button', { name: 'Dostęp' })).toBeDisabled();
  expect(signedIn ? vpsFetch : vpsPublicFetch).toHaveBeenCalledWith('/assets/badges/library', expect.objectContaining({ cache: 'no-store' }));
  expect(signedIn ? vpsPublicFetch : vpsFetch).not.toHaveBeenCalled();
});

it('opens the AI editor from an available badge', async () => {
  openLibrary();
  await screen.findByText('Widoczna grafika');
  const card = screen.getByText('Widoczna grafika').parentElement!.parentElement!;
  fireEvent.click(within(card).getByRole('button', { name: 'Edytuj AI' }));
  expect(await screen.findByText('Edytor AI?badge=visible')).toBeVisible();
});

it('unlocks the purchased package while keeping hidden badges absent', async () => {
  auth.user = { id: 'user' };
  vi.mocked(vpsFetch).mockResolvedValue({ ...library, purchasedPackageIds: ['premium'] });
  openLibrary();
  await screen.findByText('Płatna grafika');
  expect(screen.getAllByRole('button', { name: 'Edytuj AI' }).every(button => !button.hasAttribute('disabled'))).toBe(true);
  expect(screen.queryByText('Ukryta grafika')).not.toBeInTheDocument();
});

it('does not fall back to unfiltered badges after a failed request and can retry', async () => {
  vi.mocked(vpsPublicFetch).mockRejectedValueOnce(new Error('Brak połączenia'));
  openLibrary();
  expect(await screen.findByRole('alert')).toHaveTextContent('Brak połączenia');
  expect(screen.queryByText('Ukryta grafika')).not.toBeInTheDocument();
  expect(screen.queryByText('Widoczna grafika')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  await waitFor(() => expect(screen.getByText('Widoczna grafika')).toBeVisible());
});

it('refreshes visibility when returning from the admin panel', async () => {
  openLibrary();
  await screen.findByText('Widoczna grafika');
  vi.mocked(vpsPublicFetch).mockResolvedValue({ ...library, hiddenKeys: ['hidden', 'visible'] });
  fireEvent.focus(window);
  await screen.findByText('Płatna grafika');
  expect(screen.queryByText('Widoczna grafika')).not.toBeInTheDocument();
});

it('restores favorites without revealing hidden badges and searches without Polish accents', async () => {
  localStorage.setItem('kreator-favorites-badges-v1', JSON.stringify(['hidden', 'visible', 'paid']));
  openLibrary(); await screen.findByText('Widoczna grafika');
  fireEvent.click(screen.getByRole('button', { name: 'Ulubione' }));
  expect(screen.queryByText('Ukryta grafika')).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Szukaj badge'ów..."), { target: { value: 'platna' } });
  expect(screen.getByText('Płatna grafika')).toBeInTheDocument();
  expect(screen.queryByText('Widoczna grafika')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edytuj AI' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Usuń z ulubionych: Płatna grafika' }));
  expect(screen.queryByText('Płatna grafika')).not.toBeInTheDocument();
});

it('renders the whole library, puts new badges first and clears every filter with All', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-25T16:00:00Z'));
  const extra = Array.from({ length: 20 }, (_, i) => ({ id: `extra-${i}`, name: `Dodatkowy ${i}`, category: 'Webinar', description: '', src: '/extra.png' }));
  extra.push({ id: 'latest', name: 'Najnowszy bilet', category: 'Webinar', description: '', src: '/new.png', addedAt: '2026-10-25T15:00:00Z' } as typeof extra[number]);
  vi.mocked(vpsPublicFetch).mockResolvedValue({ ...library, badges: extra });
  openLibrary(); await screen.findByText('Najnowszy bilet');
  expect(screen.getAllByRole('img')).toHaveLength(23);
  expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Najnowszy bilet');
  expect(screen.getByText('Dodatkowy 19')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Pokaż więcej/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Nowe' }));
  expect(screen.getAllByRole('img')).toHaveLength(1);
  fireEvent.change(screen.getByPlaceholderText("Szukaj badge'ów..."), { target: { value: 'nie ma' } });
  expect(screen.queryAllByRole('img')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Wszystkie' }));
  expect(screen.getAllByRole('img')).toHaveLength(23);
  expect(screen.getByPlaceholderText("Szukaj badge'ów...")).toHaveValue('');
});
it('never reveals hidden new badges through the New filter or reset', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-25T16:00:00Z'));
  vi.mocked(vpsPublicFetch).mockResolvedValue({ ...library, hiddenKeys: ['hidden', 'new-hidden'], badges: [{ id: 'new-hidden', name: 'Ukryta nowość', category: 'Webinar', src: '/hidden.png', description: '', addedAt: '2026-10-25T15:00:00Z' }] });
  openLibrary(); await screen.findByText('Widoczna grafika');
  fireEvent.click(screen.getByRole('button', { name: 'Nowe' }));
  expect(screen.queryAllByRole('img')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Pokaż wszystkie badge’e' }));
  expect(screen.queryByText('Ukryta nowość')).not.toBeInTheDocument();
});
