const AUTH_SESSION_STORAGE_KEY = 'kreator-ai-auth-session';
const AUTH_REQUEST_TIMEOUT_MS = 12_000;

export type AppAuthUser = {
  id: string;
  email: string | null;
};

export type AppAuthSession = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt: number | null;
  expiresIn: number | null;
  user: AppAuthUser | null;
};

type ExchangeSessionPayload = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  expiresIn?: number | null;
  tokenType?: string | null;
};

type SessionResponse = {
  ok?: boolean;
  error?: string;
  session?: AppAuthSession | null;
};

const listeners = new Set<() => void>();
let refreshSessionPromise: Promise<AppAuthSession | null> | null = null;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getVpsApiBaseUrl = () => {
  const configured = import.meta.env.VITE_VPS_API_BASE_URL?.trim();
  return configured ? trimTrailingSlash(configured) : '/api';
};

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const notifySessionListeners = () => {
  listeners.forEach((listener) => listener());
};

const parseStoredSession = (value: string | null) => {
  if (!value) return null;

  try {
    return JSON.parse(value) as AppAuthSession;
  } catch {
    return null;
  }
};

const fetchAuthJson = async <T>(path: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getVpsApiBaseUrl()}${path}`, {
      ...init,
      headers,
      signal: init?.signal ?? controller.signal,
    });

    const text = await response.text();
    let body: any = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error('Serwer logowania zwrócił nieprawidłową odpowiedź.');
      }
    }

    if (!response.ok) {
      throw new Error(body?.error || body?.message || `Błąd logowania (${response.status}).`);
    }

    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Serwer logowania nie odpowiedział w wymaganym czasie.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const getStoredAuthSession = () => {
  if (!canUseStorage()) return null;
  return parseStoredSession(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY));
};

export const setStoredAuthSession = (session: AppAuthSession | null) => {
  if (!canUseStorage()) return;

  if (!session) {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } else {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  notifySessionListeners();
};

export const clearStoredAuthSession = () => {
  setStoredAuthSession(null);
};

export const onStoredAuthSessionChange = (listener: () => void) => {
  listeners.add(listener);

  const storageHandler = (event: StorageEvent) => {
    if (event.key === AUTH_SESSION_STORAGE_KEY) {
      listener();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', storageHandler);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
  };
};

export const isAuthSessionExpired = (session: AppAuthSession | null, thresholdSeconds = 30) => {
  if (!session?.expiresAt) return false;
  return session.expiresAt <= Math.floor(Date.now() / 1000) + thresholdSeconds;
};

export const extractAuthTokensFromUrl = (): ExchangeSessionPayload | null => {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  if (!accessToken) return null;

  const expiresAt = params.get('expires_at');
  const expiresIn = params.get('expires_in');

  return {
    accessToken,
    refreshToken: params.get('refresh_token'),
    tokenType: params.get('token_type'),
    expiresAt: expiresAt ? Number(expiresAt) : null,
    expiresIn: expiresIn ? Number(expiresIn) : null,
  };
};

export const clearAuthTokensFromUrl = () => {
  if (typeof window === 'undefined') return;
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState({}, document.title, cleanUrl);
};

export const exchangeSessionFromTokens = async (payload: ExchangeSessionPayload) => {
  const data = await fetchAuthJson<SessionResponse>('/auth/session/from-token', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!data.session) {
    throw new Error('Nie udalo sie odczytac sesji.');
  }

  setStoredAuthSession(data.session);
  return data.session;
};

export const refreshStoredAuthSession = async () => {
  if (refreshSessionPromise) return refreshSessionPromise;

  refreshSessionPromise = (async () => {
    const session = getStoredAuthSession();
    if (!session?.refreshToken) {
      clearStoredAuthSession();
      return null;
    }

    try {
      const data = await fetchAuthJson<SessionResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });

      if (!data.session) {
        clearStoredAuthSession();
        return null;
      }

      setStoredAuthSession(data.session);
      return data.session;
    } catch (error) {
      clearStoredAuthSession();
      throw error;
    }
  })().finally(() => {
    refreshSessionPromise = null;
  });

  return refreshSessionPromise;
};

export const logoutStoredAuthSession = async () => {
  const session = getStoredAuthSession();

  try {
    await fetchAuthJson('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({
        accessToken: session?.accessToken,
        refreshToken: session?.refreshToken,
      }),
    });
  } catch {
    // Even if logout request fails, we still clear local session.
  }

  clearStoredAuthSession();
};
