import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CarouselAiGenerator } from './CarouselAiGenerator';
import { vpsFetch } from '@/lib/vpsApi';
import type { CarouselGeneratorAccess } from '@/hooks/useCarouselGeneratorAccess';
vi.mock('@/lib/vpsApi', () => ({ vpsFetch: vi.fn() }));
const { session } = vi.hoisted(() => ({ session: { user: { id: 'paid-user' } } }));
vi.mock('@/lib/authSession', () => ({ getStoredAuthSession: () => session }));
const model = { id: 'model', label: 'Model testowy', cost: 25 };
const data: CarouselGeneratorAccess = { allowed: true, isAdmin: false, balance: 100, models: [model] };
let insert = vi.fn(), refresh = vi.fn(), onBusy = vi.fn();
function open(access: Partial<CarouselGeneratorAccess> = {}, other = {}, overrides = {}) {
  return render(<MemoryRouter><CarouselAiGenerator access={{ userId: 'paid-user', data: { ...data, ...access }, loading: false, error: undefined, refresh, ...other }} disabled={false} canAddImage format="portrait" slideNumber={2} onBusyChange={onBusy} onInsert={insert} {...overrides}/></MemoryRouter>);
}
async function submit() {
  fireEvent.change(screen.getByLabelText('Co chcesz wygenerować?'), { target: { value: 'Fioletowa ikona 3D, bez napisów' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generuj i wstaw/ })); });
}
beforeEach(() => {
  session.user.id = 'paid-user'; insert = vi.fn().mockResolvedValue(undefined); refresh = vi.fn(); onBusy = vi.fn();
  vi.mocked(vpsFetch).mockResolvedValue({ imageUrl: 'https://images.test/result.png' });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('locks free users and guests and never offers the generation form', () => {
  const view = open({ allowed: false });
  expect(screen.getByRole('link', { name: 'Zobacz pakiety' })).toHaveAttribute('href', '/credits');
  expect(screen.queryByLabelText('Co chcesz wygenerować?')).not.toBeInTheDocument();
  view.unmount(); open({}, { userId: undefined, data: undefined });
  expect(screen.getByRole('link', { name: 'Zaloguj się' })).toHaveAttribute('href', '/auth?returnTo=/tools/carousel');
  expect(vpsFetch).not.toHaveBeenCalled();
});
it('passes the chosen prompt, server price and model once and automatically inserts a movable element', async () => {
  open(); await submit();
  expect(vpsFetch).toHaveBeenCalledTimes(1);
  const [path, request, opts] = vi.mocked(vpsFetch).mock.calls[0];
  expect(path).toBe('/ai/carousel-image'); expect(opts).toEqual({ retryAuthOnly: true });
  expect(JSON.parse(request!.body as string)).toEqual({ prompt: 'Fioletowa ikona 3D, bez napisów', model: 'model', expectedCreditCost: 25, style: 'illustration', dimensions: '1024x1024' });
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ src: 'https://images.test/result.png' }), 'element', expect.any(AbortSignal));
  expect(onBusy.mock.calls.map(call => call[0])).toEqual([true, false]); expect(refresh).toHaveBeenCalledTimes(1);
});
it('uses the slide format for a background and explains that it affects the whole carousel', async () => {
  open(); fireEvent.change(screen.getByLabelText('Wstaw jako'), { target: { value: 'background' } });
  expect(screen.getByText(/Nowe tło zastąpi tło wszystkich slajdów/)).toBeInTheDocument();
  await submit(); expect(JSON.parse(vi.mocked(vpsFetch).mock.calls[0][1]!.body as string).dimensions).toBe('1080x1350');
  expect(insert.mock.calls[0][1]).toBe('background');
});
it('retains a paid result when insertion fails, then retries insertion without a second AI request', async () => {
  insert.mockRejectedValueOnce(new Error('Nie udało się pobrać obrazu')); open(); await submit();
  expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się pobrać obrazu');
  fireEvent.change(screen.getByLabelText('Wstaw jako'), { target: { value: 'photo' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Wstaw ponownie · bez generowania' })));
  expect(vpsFetch).toHaveBeenCalledTimes(1); expect(insert).toHaveBeenCalledTimes(2); expect(insert.mock.calls[1][1]).toBe('photo');
});
it('blocks insufficient credits but allows administrators without a balance', async () => {
  const view = open({ balance: 24 }); await submit(); expect(vpsFetch).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Ten model wymaga 25'); view.unmount();
  open({ isAdmin: true, balance: 0 }); await submit(); expect(vpsFetch).toHaveBeenCalledTimes(1);
});
it('prevents double submission while generating and locks the editor until insertion finishes', async () => {
  let resolve!: (value: { imageUrl: string }) => void;
  vi.mocked(vpsFetch).mockImplementation(() => new Promise(done => { resolve = done; }));
  open(); await submit();
  const button = screen.getByRole('button', { name: 'AI tworzy grafikę…' }); expect(button).toBeDisabled();
  fireEvent.submit(button.closest('form')!); expect(vpsFetch).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ imageUrl: 'https://images.test/result.png' }));
  await waitFor(() => expect(onBusy).toHaveBeenLastCalledWith(false));
});
it('never inserts another account’s late result or an unmounted request', async () => {
  let resolve!: (value: { imageUrl: string }) => void;
  vi.mocked(vpsFetch).mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = open(); await submit(); session.user.id = 'different-user';
  await act(async () => resolve({ imageUrl: 'https://images.test/result.png' })); expect(insert).not.toHaveBeenCalled();
  session.user.id = 'paid-user'; await submit(); const signal = vi.mocked(vpsFetch).mock.calls[1][1]!.signal!;
  view.unmount(); expect(signal.aborted).toBe(true);
  await act(async () => resolve({ imageUrl: 'https://images.test/result.png' })); expect(insert).not.toHaveBeenCalled();
});
it('offers safe recovery after network failure and blocks element limits before spending', async () => {
  vi.mocked(vpsFetch).mockRejectedValue(new Error('Błąd połączenia')); const view = open(); await submit();
  expect(screen.getByRole('alert')).toHaveTextContent('Błąd połączenia'); expect(refresh).toHaveBeenCalled(); view.unmount();
  vi.mocked(vpsFetch).mockClear(); open({}, {}, { canAddImage: false }); await submit();
  expect(vpsFetch).not.toHaveBeenCalled(); expect(screen.getByRole('status')).toHaveTextContent('Osiągnięto limit');
});
