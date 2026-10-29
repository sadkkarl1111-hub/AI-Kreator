import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SvgPromptGenerator from './SvgPromptGenerator';
import { vpsFetch, vpsPublicFetch } from '@/lib/vpsApi';

vi.mock('@/lib/vpsApi', () => ({ vpsPublicFetch: vi.fn(), vpsFetch: vi.fn() }));
const { auth, credits } = vi.hoisted(() => ({ auth: { user: { id: 'user' } as { id: string } | null, loading: false }, credits: { balance: 100, isAdmin: false, loading: false, refetch: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useCredits', () => ({ useCredits: () => credits }));
vi.mock('@/components/SvgControls', () => ({ SvgColorInput: () => null, SvgExportActions: ({ svg }: { svg: string }) => <button data-svg={svg}>Pobierz SVG</button> }));
const result = { svg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0 0 L 10 10"/></svg>', title: 'Lis na księżycu', width: 1024, height: 1024, creditsUsed: 10 };
const open = () => render(<MemoryRouter><SvgPromptGenerator /></MemoryRouter>);
const submit = async () => {
  const button = await screen.findByRole('button', { name: 'Generuj SVG · 10 kredytów' });
  await waitFor(() => expect(button).toBeEnabled());
  await act(async () => { fireEvent.click(button); });
};
beforeEach(() => {
  auth.user = { id: 'user' }; credits.balance = 100; credits.isAdmin = false;
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.mocked(vpsPublicFetch).mockResolvedValue({ available: true, creditCost: 10 });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

it('sends the entered prompt and selected format, then offers the generated vector for export', async () => {
  vi.mocked(vpsFetch).mockResolvedValueOnce(result);
  open();
  fireEvent.change(screen.getByLabelText('Co chcesz stworzyć?'), { target: { value: 'Lis na księżycu, granat i pomarańcz' } });
  fireEvent.click(screen.getByRole('button', { name: 'Stories' }));
  await submit();
  expect(await screen.findByRole('img', { name: result.title })).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
  const request = vi.mocked(vpsFetch).mock.calls[0];
  expect(request[0]).toBe('/ai/svg-generator');
  expect(request[2]).toEqual({ retryAuthOnly: true });
  expect(credits.refetch).toHaveBeenCalled();
  expect(JSON.parse(request[1]!.body as string)).toEqual({ prompt: 'Lis na księżycu, granat i pomarańcz', style: 'illustration', width: 1080, height: 1920, transparent: true, background: '#ffffff', expectedCreditCost: 10 });
  expect(screen.getByRole('button', { name: 'Pobierz SVG' })).toHaveAttribute('data-svg', result.svg);
});
it('keeps the last successful graphic when a later request fails', async () => {
  vi.mocked(vpsFetch).mockResolvedValueOnce(result).mockRejectedValueOnce(new Error('Limit generowania AI został wyczerpany'));
  open(); fireEvent.change(screen.getByLabelText('Co chcesz stworzyć?'), { target: { value: 'Lis na księżycu' } });
  await submit(); await screen.findByRole('img'); await submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('Limit generowania AI');
  expect(screen.getByRole('img')).toHaveAttribute('alt', result.title);
  expect(screen.getByRole('button', { name: 'Pobierz SVG' })).toBeEnabled();
});
it('cancels the request and discards a stale response', async () => {
  let resolve!: (value: typeof result) => void;
  vi.mocked(vpsFetch).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  open(); fireEvent.change(screen.getByLabelText('Co chcesz stworzyć?'), { target: { value: 'Lis na księżycu' } });
  await submit();
  expect(screen.getByRole('button', { name: 'Tworzę grafikę…' })).toBeDisabled();
  const signal = vi.mocked(vpsFetch).mock.calls[0][1]!.signal!;
  fireEvent.click(screen.getByRole('button', { name: 'Anuluj generowanie' }));
  expect(signal.aborted).toBe(true);
  await act(async () => { resolve(result); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Generuj SVG · 10 kredytów' })).toBeEnabled());
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('does not submit to an unconfigured provider and keeps the prompt editable', async () => {
  vi.mocked(vpsPublicFetch).mockResolvedValue({ available: false, creditCost: 10 });
  open(); fireEvent.change(screen.getByLabelText('Co chcesz stworzyć?'), { target: { value: 'Lis na księżycu' } });
  await screen.findByText(/Generator AI jest obecnie niedostępny/);
  expect(screen.getByRole('button', { name: 'Generuj SVG · 10 kredytów' })).toBeDisabled();
  expect(screen.getByLabelText('Co chcesz stworzyć?')).toBeEnabled();
  expect(vpsPublicFetch).toHaveBeenCalledTimes(1);
});
it('retries the availability check after a connection failure', async () => {
  vi.mocked(vpsPublicFetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ available: true, creditCost: 10 });
  open(); fireEvent.change(screen.getByLabelText('Co chcesz stworzyć?'), { target: { value: 'Ikona koszyka z sercem' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Spróbuj ponownie' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Generuj SVG · 10 kredytów' })).toBeEnabled());
});

it('requires login and never submits a paid generation for a guest', async () => {
  auth.user = null;
  open();
  fireEvent.change(screen.getByLabelText('Co chcesz stworzyć?'), { target: { value: 'Ikona koszyka z sercem' } });
  expect(await screen.findByRole('link', { name: 'Zaloguj się, aby generować' })).toHaveAttribute('href', '/auth?returnTo=%2Ftools%2Fsvg-generator');
  expect(screen.queryByRole('button', { name: /Generuj SVG/ })).not.toBeInTheDocument();
  expect(vpsFetch).not.toHaveBeenCalled();
});

it('shows the price and blocks submission when the balance is insufficient', async () => {
  credits.balance = 9;
  open();
  fireEvent.change(screen.getByLabelText('Co chcesz stworzyć?'), { target: { value: 'Ikona koszyka z sercem' } });
  expect(await screen.findByText('Koszt generowania: 10 kredytów')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Generuj SVG · 10 kredytów' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Doładuj konto' })).toHaveAttribute('href', '/credits');
  expect(vpsFetch).not.toHaveBeenCalled();
});

it('keeps generation blocked when pricing is missing rather than assuming a free request', async () => {
  vi.mocked(vpsPublicFetch).mockResolvedValue({ available: true });
  open();
  fireEvent.change(screen.getByLabelText('Co chcesz stworzyć?'), { target: { value: 'Ikona koszyka z sercem' } });
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Generuj SVG' })).toBeDisabled();
  expect(vpsFetch).not.toHaveBeenCalled();
});
