import {
  clearStoredAuthSession,
  getStoredAuthSession,
  isAuthSessionExpired,
  refreshStoredAuthSession,
} from "@/lib/authSession";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const AUTH_SESSION_ERROR_MESSAGE = "Sesja wygasla. Zaloguj sie ponownie.";

class VpsRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const isSessionAuthError = (value: unknown) => {
  if (!(value instanceof Error)) return false;
  const message = value.message.toLowerCase();
  return (
    message.includes("missing bearer token") ||
    message.includes("invalid or expired session token") ||
    message.includes("unauthorized")
  );
};

export const getVpsApiBaseUrl = () => {
  const configured = import.meta.env.VITE_VPS_API_BASE_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  return "/api";
};

const stripHtml = (value: string) =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildNonJsonResponseMessage = (response: Response, text: string) => {
  if (response.status === 413) {
    return "Zdjęcie jest za duże. Wybierz mniejszy plik.";
  }

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return "Serwer przerwal generowanie po zbyt dlugim czasie. Wybierz szybszy model albo sprobuj ponownie za chwile.";
  }

  const cleaned = stripHtml(text);
  if (cleaned) {
    return cleaned.slice(0, 240);
  }

  return `Serwer zwrocil niepoprawna odpowiedz (${response.status}).`;
};

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const message = buildNonJsonResponseMessage(response, text);
    if (!response.ok) {
      return { error: message };
    }

    throw new Error(message);
  }
};

const buildHeaders = (init?: RequestInit, accessToken?: string) => {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
};

const performRequest = async <T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> => {
  const response = await fetch(`${getVpsApiBaseUrl()}${path}`, {
    ...init,
    headers: buildHeaders(init, accessToken),
  });

  const body = await parseJsonResponse(response);

  if (!response.ok) {
    throw new VpsRequestError(body?.error || body?.message || `Request failed with status ${response.status}`, response.status);
  }

  return body as T;
};

export const vpsFetch = async <T>(path: string, init?: RequestInit, options?: { retryAuthOnly?: boolean }): Promise<T> => {
  const requestInit: RequestInit = {
    ...init,
    cache: "no-store",
  };

  let session = getStoredAuthSession();

  if (session && !session.accessToken && session.refreshToken) {
    session = await refreshStoredAuthSession().catch(() => null);
  }

  if (session && isAuthSessionExpired(session)) {
    session = await refreshStoredAuthSession().catch(() => null);
  }

  if (!session?.accessToken) {
    clearStoredAuthSession();
    throw new Error(AUTH_SESSION_ERROR_MESSAGE);
  }

  try {
    return await performRequest<T>(path, requestInit, session.accessToken);
  } catch (error) {
    if (requestInit.signal?.aborted) throw error;
    if (options?.retryAuthOnly && (!(error instanceof VpsRequestError) || error.status !== 401)) throw error;
    if (!session?.refreshToken) {
      if (isSessionAuthError(error)) {
        clearStoredAuthSession();
        throw new Error(AUTH_SESSION_ERROR_MESSAGE);
      }
      throw error;
    }

    const refreshedSession = await refreshStoredAuthSession().catch(() => null);
    if (!refreshedSession?.accessToken) {
      clearStoredAuthSession();
      throw new Error(AUTH_SESSION_ERROR_MESSAGE);
    }

    return performRequest<T>(path, requestInit, refreshedSession.accessToken);
  }
};

export const vpsPublicFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  return performRequest<T>(path, init);
};
