import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setStoredAuthSession } from '@/lib/authSession';
import { vpsPublicFetch } from '@/lib/vpsApi';

type AuthSessionPayload = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt: number | null;
  expiresIn: number | null;
  user: {
    id: string;
    email: string | null;
  } | null;
};

type GoogleCallbackResponse = {
  ok?: boolean;
  error?: string;
  redirectTo?: string;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string | null;
  session?: AuthSessionPayload | null;
};

const normalizeSafeReturnTo = (value?: string | null) => {
  const trimmed = value?.trim();
  const normalizedSeparators = trimmed?.replace(/\\/g, '/');

  if (
    !trimmed ||
    !normalizedSeparators ||
    !normalizedSeparators.startsWith('/') ||
    normalizedSeparators.startsWith('//') ||
    normalizedSeparators.toLowerCase().startsWith('/auth') ||
    /[\u0000-\u001f\u007f]/.test(normalizedSeparators)
  ) {
    return '/dashboard';
  }

  return normalizedSeparators;
};

const translateGoogleCallbackError = (message: string) => {
  const lower = message.toLowerCase();

  if (lower.includes('cancel') || lower.includes('access_denied')) {
    return 'Logowanie Google zostało anulowane.';
  }
  if (lower.includes('state')) {
    return 'Sesja logowania Google wygasła. Spróbuj ponownie.';
  }
  if (lower.includes('config')) {
    return 'Logowanie Google nie jest jeszcze poprawnie skonfigurowane.';
  }

  return message || 'Nie udało się dokończyć logowania przez Google.';
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const finishGoogleLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const googleError = params.get('error');
      const googleErrorDescription = params.get('error_description');
      const code = params.get('code');
      const state = params.get('state');

      if (googleError) {
        setError(translateGoogleCallbackError(googleErrorDescription || googleError));
        return;
      }

      if (!code || !state) {
        setError('Brak danych potrzebnych do dokończenia logowania Google.');
        return;
      }

      try {
        const data = await vpsPublicFetch<GoogleCallbackResponse>('/auth/google/callback', {
          method: 'POST',
          body: JSON.stringify({ code, state }),
        });

        if (data.requiresTwoFactor && data.twoFactorToken) {
          if (cancelled) return;

          const params = new URLSearchParams();
          params.set('two_factor_token', data.twoFactorToken);
          params.set('returnTo', normalizeSafeReturnTo(data.redirectTo));
          navigate(`/auth?${params.toString()}`, { replace: true });
          return;
        }

        if (!data.session) {
          throw new Error(data.error || 'Nie udało się odczytać sesji po logowaniu Google.');
        }

        if (cancelled) return;

        setStoredAuthSession(data.session);
        navigate(normalizeSafeReturnTo(data.redirectTo), { replace: true });
      } catch (caughtError) {
        if (cancelled) return;
        setError(
          translateGoogleCallbackError(caughtError instanceof Error ? caughtError.message : 'Nie udało się dokończyć logowania Google.'),
        );
      }
    };

    void finishGoogleLogin();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-[#1a1028] dark:via-[#1e1530] dark:to-[#15112a] px-4">
        <div className="bg-card rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Nie udało się zalogować przez Google</h2>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={() => navigate('/auth', { replace: true })} variant="outline">
            Wróć do logowania
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-[#1a1028] dark:via-[#1e1530] dark:to-[#15112a] px-4">
      <div className="bg-card rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
        <LoaderCircle className="w-10 h-10 animate-spin text-primary mx-auto" />
        <h2 className="text-lg font-semibold text-foreground">Kończymy logowanie Google...</h2>
        <p className="text-muted-foreground text-sm">Jeszcze chwila i przeniesiemy Cię do aplikacji.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
