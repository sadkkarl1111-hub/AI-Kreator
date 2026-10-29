import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { reportFrontendError } from '@/lib/frontendErrorReporter';

type ErrorBoundaryProps = {
  children: ReactNode;
  resetKey?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  isChunkLoadError: boolean;
};

const CHUNK_RELOAD_STORAGE_PREFIX = 'kreator-ai-chunk-reload';
const CHUNK_RELOAD_COOLDOWN_MS = 5 * 60 * 1000;

function isChunkLoadError(error: Error) {
  const message = `${error?.name || ''} ${error?.message || ''}`.toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('loading chunk') ||
    message.includes('chunkloaderror') ||
    message.includes('importing a module script failed') ||
    message.includes('dynamically imported module')
  );
}

function getChunkReloadKey(resetKey?: string) {
  return `${CHUNK_RELOAD_STORAGE_PREFIX}:${resetKey || window.location.pathname}`;
}

function shouldAutoReloadAfterChunkError(resetKey?: string) {
  try {
    const key = getChunkReloadKey(resetKey);
    const lastReload = Number(window.sessionStorage.getItem(key) || 0);
    const now = Date.now();

    if (lastReload && now - lastReload < CHUNK_RELOAD_COOLDOWN_MS) {
      return false;
    }

    window.sessionStorage.setItem(key, String(now));
    return true;
  } catch {
    return false;
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    isChunkLoadError: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      isChunkLoadError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const chunkLoadError = isChunkLoadError(error);

    reportFrontendError({
      message: error?.message || 'Błąd renderowania aplikacji',
      stack: error?.stack || null,
      errorType: chunkLoadError ? 'chunk-load-error' : 'react-error-boundary',
      componentStack: info.componentStack,
    });

    if (chunkLoadError && shouldAutoReloadAfterChunkError(this.props.resetKey)) {
      window.location.reload();
      return;
    }

    console.error('Frontend error boundary:', error, info);
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, isChunkLoadError: false });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.state.isChunkLoadError ? 'Odświeżamy aplikację' : 'Coś poszło nie tak';
    const description = this.state.isChunkLoadError
      ? 'Właśnie pojawiła się nowa wersja aplikacji. Odśwież stronę, żeby wczytać aktualne pliki.'
      : 'Aplikacja napotkała błąd w tym widoku. Możesz odświeżyć stronę albo wrócić do dashboardu.';

    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button className="gap-1.5" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" /> Odśwież
            </Button>
            <Button asChild variant="outline" className="gap-1.5">
              <a href="/dashboard">
                <Home className="h-4 w-4" /> Dashboard
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
