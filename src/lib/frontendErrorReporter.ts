import { getStoredAuthSession } from '@/lib/authSession';
import { getVpsApiBaseUrl } from '@/lib/vpsApi';

type FrontendErrorPayload = {
  message: string;
  stack?: string | null;
  errorType: string;
  source?: string;
  componentStack?: string | null;
  metadata?: Record<string, unknown> | null;
};

const MAX_REPORTS_PER_PAGE = 8;
const reportedFingerprints = new Set<string>();
let reportCount = 0;
let installed = false;

const trimText = (value: unknown, max = 4000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message || error.name || 'Frontend error';
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Frontend error';
  }
};

const getErrorStack = (error: unknown) => (error instanceof Error ? error.stack || null : null);

export const reportFrontendError = (payload: FrontendErrorPayload) => {
  if (typeof window === 'undefined') return;
  if (reportCount >= MAX_REPORTS_PER_PAGE) return;

  const message = trimText(payload.message, 2000) || 'Frontend error';
  const stack = trimText(payload.stack || '', 8000) || null;
  const fingerprint = `${payload.errorType}|${message}|${stack?.slice(0, 300) || ''}`;
  if (reportedFingerprints.has(fingerprint)) return;

  reportedFingerprints.add(fingerprint);
  reportCount += 1;

  const session = getStoredAuthSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const body = JSON.stringify({
    message,
    stack,
    errorType: payload.errorType,
    source: payload.source || 'frontend',
    url: window.location.href,
    path: `${window.location.pathname}${window.location.search}`,
    userAgent: window.navigator.userAgent,
    componentStack: trimText(payload.componentStack || '', 8000) || null,
    metadata: payload.metadata || null,
  });

  fetch(`${getVpsApiBaseUrl()}/client-errors/report`, {
    method: 'POST',
    headers,
    body,
    keepalive: body.length < 60_000,
  }).catch(() => undefined);
};

export const installFrontendErrorReporting = () => {
  if (typeof window === 'undefined' || installed) return;
  installed = true;

  window.addEventListener('error', (event) => {
    reportFrontendError({
      message: event.message || getErrorMessage(event.error),
      stack: getErrorStack(event.error),
      errorType: 'window-error',
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportFrontendError({
      message: getErrorMessage(event.reason),
      stack: getErrorStack(event.reason),
      errorType: 'unhandled-rejection',
    });
  });
};
