import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, Check, Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PASSWORD_RULES, getPasswordValidationError } from '@/lib/passwordValidation';
import { clearAuthTokensFromUrl, extractAuthTokensFromUrl } from '@/lib/authSession';
import { vpsPublicFetch } from '@/lib/vpsApi';

type PasswordResetConfirmResponse = {
  ok?: boolean;
  error?: string;
};

type PasswordResetVerifyResponse = {
  ok?: boolean;
  error?: string;
  accessToken?: string;
};

const translateResetPasswordError = (message: string) => {
  const rules: Array<[RegExp, string]> = [
    [/Password should be at least (\d+) characters/i, 'Haslo musi miec co najmniej $1 znakow.'],
    [/Password should contain at least one character of each/i, 'Haslo musi zawierac mala litere, duza litere, cyfre i znak specjalny.'],
    [/Password is known to be weak and easy to guess/i, 'To haslo jest zbyt proste i latwe do odgadniecia.'],
    [/same password/i, 'Nowe haslo musi roznic sie od poprzedniego.'],
    [/invalid/i, 'Nie udalo sie zmienic hasla. Sprobuj ponownie.'],
  ];

  for (const [pattern, replacement] of rules) {
    if (pattern.test(message)) {
      return message.replace(pattern, replacement);
    }
  }

  return message || 'Nie udalo sie zmienic hasla.';
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState('');
  const [error, setError] = useState('');
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const bootstrapResetLink = async () => {
      const tokens = extractAuthTokensFromUrl();

      if (tokens?.accessToken) {
        setRecoveryAccessToken(tokens.accessToken);
        clearAuthTokensFromUrl();
        setVerifying(false);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      const type = params.get('type');

      if (!tokenHash || type !== 'recovery') {
        setVerifyError('Nie udalo sie zweryfikowac linku resetujacego. Link mogl wygasnac albo jest nieprawidlowy.');
        setVerifying(false);
        return;
      }

      try {
        const data = await vpsPublicFetch<PasswordResetVerifyResponse>('/auth/password-reset/verify', {
          method: 'POST',
          body: JSON.stringify({ tokenHash, type }),
        });

        if (!data.accessToken) {
          throw new Error(data.error || 'Nie udalo sie zweryfikowac linku resetujacego.');
        }

        if (cancelled) return;

        setRecoveryAccessToken(data.accessToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (caughtError) {
        if (cancelled) return;
        setVerifyError(
          translateResetPasswordError(
            caughtError instanceof Error ? caughtError.message : 'Nie udalo sie zweryfikowac linku resetujacego.',
          ),
        );
      } finally {
        if (!cancelled) {
          setVerifying(false);
        }
      }
    };

    void bootstrapResetLink();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!recoveryAccessToken) {
      setError('Link resetujacy jest nieprawidlowy albo wygasl.');
      return;
    }

    const passwordValidationError = getPasswordValidationError(password);
    if (passwordValidationError) {
      setError(passwordValidationError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Hasla nie sa identyczne.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await vpsPublicFetch<PasswordResetConfirmResponse>('/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({
          accessToken: recoveryAccessToken,
          password,
        }),
      });

      toast.success('Haslo zostalo zmienione.');
      navigate('/auth');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : '';
      setError(translateResetPasswordError(message));
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-[#1a1028] dark:via-[#1e1530] dark:to-[#15112a] px-4">
        <div className="bg-card rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Weryfikacja linku resetujacego...</p>
        </div>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-[#1a1028] dark:via-[#1e1530] dark:to-[#15112a] px-4">
        <div className="bg-card rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Blad weryfikacji</h2>
          <p className="text-muted-foreground text-sm">{verifyError}</p>
          <Button onClick={() => navigate('/auth')} variant="outline" className="mt-4">
            Wroc do logowania
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-[#1a1028] dark:via-[#1e1530] dark:to-[#15112a] px-4">
      <div className="bg-card rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ustaw nowe haslo</h1>
            <p className="text-sm text-muted-foreground">Wpisz nowe haslo ponizej</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">Nowe haslo</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Wpisz nowe haslo"
                required
                minLength={6}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Ukryj haslo' : 'Pokaz haslo'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">Powtorz haslo</label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Powtorz nowe haslo"
                required
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showConfirmPassword ? 'Ukryj potwierdzenie hasla' : 'Pokaz potwierdzenie hasla'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-foreground">Wymagania hasla</p>
            {PASSWORD_RULES.map((rule) => {
              const isMet = rule.test(password);

              return (
                <div
                  key={rule.label}
                  className={`flex items-center gap-2 text-xs ${isMet ? 'text-emerald-600' : 'text-muted-foreground'}`}
                >
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                      isMet ? 'border-emerald-500 bg-emerald-50' : 'border-border bg-background'
                    }`}
                  >
                    {isMet ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span>{rule.label}</span>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground pt-1">
              Haslo nie powinno byc zbyt oczywiste. Przyklady slabych hasel: Test123#, Haslo123!, Admin2024!.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Zmieniam haslo...' : 'Zmien haslo'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
