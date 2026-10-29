import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { vpsFetch } from './vpsApi';
import { getStoredAuthSession, refreshStoredAuthSession, isAuthSessionExpired } from './authSession';
vi.mock('./authSession', () => ({ getStoredAuthSession: vi.fn(), refreshStoredAuthSession: vi.fn(), isAuthSessionExpired: vi.fn(), clearStoredAuthSession: vi.fn() }));
const session = { accessToken: 'test-token', refreshToken: 'test-refresh', tokenType: 'bearer', expiresAt: null, expiresIn: null, user: null };
beforeEach(() => { vi.mocked(getStoredAuthSession).mockReturnValue(session); vi.mocked(isAuthSessionExpired).mockReturnValue(false); vi.mocked(refreshStoredAuthSession).mockResolvedValue({ ...session, accessToken: 'new-token' }); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('does not repeat generation on 502 or network failures', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ error: 'Spróbuj ponownie' }, { status: 502 })); vi.stubGlobal('fetch', fetch);
  await expect(vpsFetch('/ad-generator/generate', { method: 'POST' }, { retryAuthOnly: true })).rejects.toThrow('Spróbuj ponownie');
  expect(fetch).toHaveBeenCalledTimes(1); expect(refreshStoredAuthSession).not.toHaveBeenCalled();
  fetch.mockRejectedValueOnce(new TypeError('network'));
  await expect(vpsFetch('/ad-generator/generate', {}, { retryAuthOnly: true })).rejects.toThrow('network');
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('refreshes an expired token once for a 401', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ error: 'unauthorized' }, { status: 401 })).mockResolvedValueOnce(Response.json({ ok: true })); vi.stubGlobal('fetch', fetch);
  await expect(vpsFetch('/ad-generator/generate', {}, { retryAuthOnly: true })).resolves.toEqual({ ok: true });
  expect(refreshStoredAuthSession).toHaveBeenCalledTimes(1); expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer new-token');
});
