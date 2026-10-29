import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCarouselGeneratorAccess } from './useCarouselGeneratorAccess';
import { vpsFetch } from '@/lib/vpsApi';
const { auth } = vi.hoisted(() => ({ auth: { user: { id: 'paid' } as { id: string } | null, loading: false } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/lib/vpsApi', () => ({ vpsFetch: vi.fn() }));
const data = { allowed: true, isAdmin: false, balance: 100, models: [] };
beforeEach(() => { auth.user = { id: 'paid' }; vi.mocked(vpsFetch).mockResolvedValue(data); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('does not request private entitlement for a guest', async () => {
  auth.user = null; const { result } = renderHook(useCarouselGeneratorAccess);
  await act(async () => {}); expect(result.current.loading).toBe(false); expect(result.current.data).toBeUndefined(); expect(vpsFetch).not.toHaveBeenCalled();
});
it('discards a previous account entitlement immediately and ignores its delayed response', async () => {
  let resolve!: (value: typeof data) => void;
  vi.mocked(vpsFetch).mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValueOnce({ ...data, allowed: false });
  const { result, rerender } = renderHook(useCarouselGeneratorAccess);
  await waitFor(() => expect(vpsFetch).toHaveBeenCalledTimes(1));
  auth.user = { id: 'free' }; rerender(); expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(result.current.data?.allowed).toBe(false));
  await act(async () => resolve(data)); expect(result.current.userId).toBe('free'); expect(result.current.data?.allowed).toBe(false);
});
it('fails closed on status refresh failure and can recover after retry', async () => {
  const { result } = renderHook(useCarouselGeneratorAccess);
  await waitFor(() => expect(result.current.data?.allowed).toBe(true));
  vi.mocked(vpsFetch).mockRejectedValueOnce(new Error('offline'));
  await act(async () => result.current.refresh()); expect(result.current.data).toBeUndefined(); expect(result.current.error).toBe('offline');
  await act(async () => result.current.refresh()); expect(result.current.data?.allowed).toBe(true); expect(result.current.error).toBeUndefined();
});
