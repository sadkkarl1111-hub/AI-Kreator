import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Palette, Sparkles, Wand2, Paintbrush, ImageIcon, CheckCircle2, Circle } from 'lucide-react';
import { setStoredAuthSession } from '@/lib/authSession';
import { useAuth } from '@/hooks/useAuth';
import { getVpsApiBaseUrl, vpsPublicFetch } from '@/lib/vpsApi';
import { getPasswordValidationError } from '@/lib/passwordValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { PublicGallery } from '@/components/PublicGallery';

declare global {
  interface Window {
    grecaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => number;
      reset: (id: number) => void;
    };
    onRecaptchaLoad?: () => void;
  }
}

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

type AuthActionResponse = {
  ok?: boolean;
  error?: string;
  session?: AuthSessionPayload | null;
  redirectTo?: string | null;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string | null;
  user?: {
    id: string;
    email: string | null;
  } | null;
  requiresEmailConfirmation?: boolean;
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

const translateAuthError = (message: string) => {
  const rules: Array<[RegExp, string]> = [
    [/Password should be at least (\d+) characters/i, 'Hasło musi mieć co najmniej $1 znaków.'],
    [/Password should contain at least one character of each/i, 'Hasło musi zawierać małą literę, dużą literę, cyfrę i znak specjalny.'],
    [/Password is known to be weak and easy to guess/i, 'To hasło jest zbyt proste i łatwe do odgadnięcia.'],
    [/User already registered/i, 'Ten email jest już zarejestrowany.'],
    [/Invalid login credentials/i, 'Nieprawidłowy email lub hasło.'],
    [/Email not confirmed/i, 'Potwierdź swój email przed zalogowaniem.'],
    [/Email rate limit exceeded/i, 'Zbyt wiele prób. Spróbuj ponownie za chwilę.'],
    [/For security purposes, you can only request this/i, 'Ze względów bezpieczeństwa poczekaj chwilę przed kolejną próbą.'],
    [/Signup requires a valid password/i, 'Rejestracja wymaga prawidłowego hasła.'],
    [/Unable to validate email address/i, 'Nieprawidłowy adres email.'],
    [
      /Darmowe kredyty startowe zostaly juz wykorzystane/i,
      'Darmowe kredyty startowe zostały już wykorzystane z tego adresu IP. Zaloguj się na istniejące konto lub skontaktuj się z pomocą.',
    ],
  ];

  for (const [pattern, replacement] of rules) {
    if (pattern.test(message)) {
      return message.replace(pattern, replacement);
    }
  }

  return message || 'Wystąpił błąd autoryzacji.';
};

const translateGoogleAuthError = (message: string) => {
  const lower = message.toLowerCase();

  if (lower.includes('cancel') || lower.includes('access_denied')) {
    return 'Logowanie Google zostało anulowane.';
  }
  if (lower.includes('config')) {
    return 'Logowanie Google nie jest jeszcze poprawnie skonfigurowane.';
  }
  if (lower.includes('darmowe kredyty startowe zostaly juz wykorzystane')) {
    return 'Darmowe kredyty startowe zostały już wykorzystane z tego adresu IP. Zaloguj się na istniejące konto lub skontaktuj się z pomocą.';
  }

  return message || 'Nie udało się zalogować przez Google.';
};

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaConfig, setCaptchaConfig] = useState<{ provider: string; siteKey: string }>({
    provider: 'recaptcha',
    siteKey: '',
  });

  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaWidgetId = useRef<number | null>(null);
  const getSafeReturnTo = useCallback(() => {
    const params = new URLSearchParams(location.search);
    return normalizeSafeReturnTo(params.get('returnTo'));
  }, [location.search]);

  useEffect(() => {
    if (user) {
      navigate(getSafeReturnTo(), { replace: true });
    }
  }, [getSafeReturnTo, user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authError = params.get('auth_error');
    const emailConfirmed = params.get('email_confirmed');
    const urlTwoFactorToken = params.get('two_factor_token');
    if (!authError && !emailConfirmed && !urlTwoFactorToken) return;

    if (authError) {
      toast.error(translateGoogleAuthError(authError));
      params.delete('auth_error');
    }

    if (emailConfirmed === '1') {
      toast.success('Email potwierdzony. Możesz się zalogować.');
      params.delete('email_confirmed');
    } else if (emailConfirmed) {
      toast.error('Link potwierdzający email jest nieprawidłowy albo wygasł.');
      params.delete('email_confirmed');
    }

    if (urlTwoFactorToken) {
      setTwoFactorToken(urlTwoFactorToken);
      setTwoFactorCode('');
      setUseRecoveryCode(false);
      setIsLogin(true);
      setIsForgotPassword(false);
      toast.info('Podaj kod 2FA, aby dokończyć logowanie admina.');
      params.delete('two_factor_token');
    }

    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await vpsPublicFetch<{ ok?: boolean; settings?: Record<string, string> }>(
          '/public/settings?keys=captcha_provider,captcha_site_key',
        );
        const map = data.settings || {};
        setCaptchaConfig({
          provider: map.captcha_provider || 'recaptcha',
          siteKey: map.captcha_site_key || '',
        });
      } catch (error) {
        console.error('Captcha config load error:', error);
      }
    };

    void loadConfig();
  }, []);

  const captchaEnabled = captchaConfig.provider !== 'none' && Boolean(captchaConfig.siteKey);

  useEffect(() => {
    if (!captchaEnabled || captchaConfig.provider !== 'recaptcha') return;

    if (document.querySelector('script[src*="recaptcha/api.js"]')) {
      return;
    }

    window.onRecaptchaLoad = () => undefined;

    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [captchaConfig.provider, captchaEnabled]);

  const renderCaptcha = useCallback(() => {
    if (!captchaEnabled || captchaConfig.provider !== 'recaptcha' || !captchaRef.current) {
      return;
    }

    if (captchaWidgetId.current !== null) {
      try {
        window.grecaptcha?.reset(captchaWidgetId.current);
      } catch {
        // ignore widget reset errors
      }
      captchaWidgetId.current = null;
    }

    captchaRef.current.innerHTML = '';
    setCaptchaToken(null);

    const tryRender = () => {
      if (window.grecaptcha && captchaRef.current) {
        try {
          captchaWidgetId.current = window.grecaptcha.render(captchaRef.current, {
            sitekey: captchaConfig.siteKey,
            callback: (token: string) => setCaptchaToken(token),
            'expired-callback': () => setCaptchaToken(null),
            theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          });
        } catch (error) {
          console.error('reCAPTCHA render error:', error);
        }
      } else {
        window.setTimeout(tryRender, 300);
      }
    };

    tryRender();
  }, [captchaConfig.provider, captchaConfig.siteKey, captchaEnabled]);

  useEffect(() => {
    if (!isLogin && !isForgotPassword) {
      renderCaptcha();
    }
  }, [isForgotPassword, isLogin, renderCaptcha]);

  const handleGoogleSignIn = async () => {
    try {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      const returnTo = currentPath.startsWith('/auth') ? getSafeReturnTo() : normalizeSafeReturnTo(currentPath);
      const googleStartUrl = `${getVpsApiBaseUrl()}/auth/google?returnTo=${encodeURIComponent(returnTo)}`;

      const isEmbedded = window.self !== window.top;
      if (isEmbedded) {
        const popup = window.open(googleStartUrl, '_blank', 'noopener,noreferrer');
        if (popup) return;
      }

      window.location.assign(googleStartUrl);
    } catch {
      toast.error('Nie udało się rozpocząć logowania przez Google.');
    }
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email) {
      toast.error('Podaj adres email.');
      return;
    }

    setLoading(true);

    try {
      const data = await vpsPublicFetch<{ ok?: boolean; error?: string }>('/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      if (data?.error === 'user_not_found') {
        toast.error('Nie znaleziono konta z tym adresem email.');
        return;
      }

      toast.success('Link do resetu hasła został wysłany na Twój email.');
      setIsForgotPassword(false);
    } catch (error: any) {
      if (error?.message === 'user_not_found') {
        toast.error('Nie znaleziono konta z tym adresem email.');
        return;
      }

      toast.error('Nie udało się wysłać linku resetującego.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !password) {
      toast.error('Wypelnij wszystkie pola.');
      return;
    }

    if (!isLogin && !termsAccepted) {
      toast.error('Musisz zaakceptować regulamin i politykę prywatności.');
      return;
    }

    if (!isLogin && captchaEnabled && !captchaToken) {
      toast.error('Potwierdź, że nie jesteś robotem.');
      return;
    }

    if (!isLogin) {
      const passwordValidationError = getPasswordValidationError(password);
      if (passwordValidationError) {
        toast.error(passwordValidationError);
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const data = await vpsPublicFetch<AuthActionResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password, returnTo: getSafeReturnTo() }),
        });

        if (data.requiresTwoFactor && data.twoFactorToken) {
          setTwoFactorToken(data.twoFactorToken);
          setTwoFactorCode('');
          setUseRecoveryCode(false);
          toast.info('Podaj kod 2FA, aby dokończyć logowanie admina.');
          return;
        }

        if (!data.session) {
          toast.error('Nie udało się zalogować.');
          return;
        }

        setStoredAuthSession(data.session);
        toast.success('Zalogowano!');
        navigate(getSafeReturnTo(), { replace: true });
        return;
      }

      const data = await vpsPublicFetch<AuthActionResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          marketingConsent,
          captchaToken,
        }),
      });

      if (data.error) {
        toast.error(translateAuthError(data.error));
        return;
      }

      toast.success(
        data.requiresEmailConfirmation
          ? 'Sprawdź skrzynkę email i potwierdź konto przed logowaniem.'
          : 'Konto zostało utworzone.',
      );
    } catch (error: any) {
      toast.error(translateAuthError(error?.message || 'Wystąpił błąd autoryzacji.'));
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!twoFactorToken || !twoFactorCode.trim()) {
      toast.error(useRecoveryCode ? 'Podaj kod odzyskiwania.' : 'Podaj 6-cyfrowy kod 2FA.');
      return;
    }

    setLoading(true);

    try {
      const data = await vpsPublicFetch<AuthActionResponse>('/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({
          challengeToken: twoFactorToken,
          ...(useRecoveryCode ? { recoveryCode: twoFactorCode } : { code: twoFactorCode }),
        }),
      });

      if (!data.session) {
        toast.error(data.error || 'Nieprawidłowy kod 2FA.');
        return;
      }

      setStoredAuthSession(data.session);
      setTwoFactorToken(null);
      setTwoFactorCode('');
      setUseRecoveryCode(false);
      toast.success('Zalogowano!');
      navigate(data.redirectTo || getSafeReturnTo(), { replace: true });
    } catch (error: any) {
      toast.error(translateAuthError(error?.message || 'Nie udało się zweryfikować 2FA.'));
    } finally {
      setLoading(false);
    }
  };

  const passwordRequirements = [
    { id: 'min-6', label: 'Minimum 6 znaków', valid: password.length >= 6 },
    { id: 'lower', label: 'Mała litera (a-z)', valid: /[a-z]/.test(password) },
    { id: 'upper', label: 'Duża litera (A-Z)', valid: /[A-Z]/.test(password) },
    { id: 'digit', label: 'Cyfra (0-9)', valid: /\d/.test(password) },
    { id: 'special', label: 'Znak specjalny (np. # ! % @)', valid: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 gradient-bg opacity-20" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute bottom-20 right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: '1s' }}
      />
      <div
        className="absolute top-1/2 left-1/2 w-64 h-64 bg-secondary/20 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: '2s' }}
      />

      <div className="relative z-10 flex flex-col items-center min-h-screen py-4 sm:py-12 px-4 gap-5 sm:gap-12">
        <motion.section
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-2xl pt-0 sm:pt-8"
        >
          <div className="sm:hidden max-w-md mx-auto space-y-3">
            <div className="flex items-center justify-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="flex items-center justify-center w-12 h-12 rounded-xl gradient-bg shrink-0"
              >
                <Palette className="w-6 h-6 text-primary-foreground" />
              </motion.div>
              <div className="text-left">
                <p className="text-lg font-bold gradient-text leading-tight">Kreator Grafik AI</p>
                <p className="text-xs text-muted-foreground">Logowanie i rejestracja</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Twórz grafiki z AI szybciej i wygodniej, także z poziomu telefonu.
            </p>
          </div>

          <div className="hidden sm:block text-center max-w-2xl mx-auto">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-bg mb-6"
            >
              <Palette className="w-10 h-10 text-primary-foreground" />
            </motion.div>
            <h1 className="text-4xl sm:text-5xl font-bold gradient-text mb-4">Kreator Grafik AI</h1>
            <p className="text-lg text-muted-foreground mb-4">
              Twórz profesjonalne grafiki na social media w kilka sekund dzięki sztucznej inteligencji.
              Wystarczy opisać, co chcesz, a resztą zajmie się AI.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary">
                <Sparkles className="w-4 h-4" />
                Wiele narzędzi za darmo
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-sm font-medium text-accent-foreground">
                75 kredytów na start
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary/80 border border-border text-sm font-medium text-secondary-foreground">
                +5 kredytów codziennie gratis
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/60 backdrop-blur border">
                <Wand2 className="w-6 h-6 text-primary" />
                <span className="font-medium">Generuj z opisu</span>
                 <span className="text-muted-foreground text-xs">Wpisz prompt i otrzymaj unikalną grafikę.</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/60 backdrop-blur border">
                <Paintbrush className="w-6 h-6 text-primary" />
                 <span className="font-medium">Edytuj zdjęcia</span>
                 <span className="text-muted-foreground text-xs">Modyfikuj istniejące obrazy z AI.</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/60 backdrop-blur border">
                <ImageIcon className="w-6 h-6 text-primary" />
                <span className="font-medium">Galeria i eksport</span>
                 <span className="text-muted-foreground text-xs">Zapisuj, udostępniaj i pobieraj.</span>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-4 sm:mb-6">
            <p className="text-muted-foreground flex items-center justify-center gap-1">
              <Sparkles className="w-4 h-4" />
              Zacznij tworzyć za darmo
            </p>
          </div>

          <Card className="glass-card shadow-lg" style={{ boxShadow: 'var(--shadow-glow)' }}>
            <CardHeader>
              <CardTitle>{isForgotPassword ? 'Reset hasła' : isLogin ? 'Logowanie' : 'Rejestracja'}</CardTitle>
              <CardDescription>
                {isForgotPassword
                  ? 'Podaj email, a wyślemy Ci link do resetu hasła.'
                  : isLogin
                    ? 'Zaloguj się do swojego konta.'
                    : 'Stwórz nowe konto.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {twoFactorToken ? (
                <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                    {useRecoveryCode
                      ? 'Wpisz jednorazowy kod odzyskiwania zapisany przy konfiguracji 2FA.'
                      : 'Logowanie administratora wymaga kodu z aplikacji uwierzytelniającej.'}
                  </div>
                  <Input
                    inputMode={useRecoveryCode ? 'text' : 'numeric'}
                    autoComplete="one-time-code"
                    placeholder={useRecoveryCode ? 'Kod odzyskiwania, np. ABCD-EFGH-12' : 'Kod 2FA, np. 123456'}
                    value={twoFactorCode}
                    onChange={(event) => {
                      const value = event.target.value;
                      setTwoFactorCode(useRecoveryCode ? value.toUpperCase().slice(0, 18) : value.replace(/\D/g, '').slice(0, 6));
                    }}
                    required
                  />
                  <Button type="submit" className="w-full gradient-bg hover:opacity-90 transition-opacity" disabled={loading}>
                    {loading ? 'Sprawdzanie...' : useRecoveryCode ? 'Potwierdź kod odzyskiwania' : 'Potwierdź kod 2FA'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setUseRecoveryCode((current) => !current);
                      setTwoFactorCode('');
                    }}
                  >
                    {useRecoveryCode ? 'Użyj kodu z aplikacji' : 'Użyj kodu odzyskiwania'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setTwoFactorToken(null);
                      setTwoFactorCode('');
                      setUseRecoveryCode(false);
                    }}
                  >
                    Wróć do logowania
                  </Button>
                </form>
              ) : isForgotPassword ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full gradient-bg hover:opacity-90 transition-opacity" disabled={loading}>
                    {loading ? 'Wysyłanie...' : 'Wyślij link resetujący'}
                  </Button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(false)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      Wróć do logowania
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />

                    <div className="space-y-2">
                      <Input
                        type="password"
                        placeholder="Hasło"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={6}
                      />
                      {!isLogin && (
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">Wymagania hasła:</p>
                          <div className="space-y-1">
                            {passwordRequirements.map((requirement) => (
                              <div
                                key={requirement.id}
                                className={`flex items-center gap-2 text-xs ${
                                  requirement.valid ? 'text-emerald-600' : 'text-muted-foreground'
                                }`}
                              >
                                {requirement.valid ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span>{requirement.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {isLogin && (
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => setIsForgotPassword(true)}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          Zapomniałeś hasła?
                        </button>
                      </div>
                    )}

                    {!isLogin && (
                      <>
                        <div className="flex items-start space-x-2">
                          <Checkbox
                            id="terms"
                            checked={termsAccepted}
                            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                            required
                          />
                          <label htmlFor="terms" className="text-xs text-muted-foreground leading-snug cursor-pointer">
                            Akceptuję <Link to="/regulamin" className="text-primary hover:underline">Regulamin</Link> i{' '}
                            <Link to="/polityka-prywatnosci" className="text-primary hover:underline">Politykę Prywatności</Link>.
                          </label>
                        </div>

                        <div className="flex items-start space-x-2">
                          <Checkbox
                            id="marketing"
                            checked={marketingConsent}
                            onCheckedChange={(checked) => setMarketingConsent(checked === true)}
                          />
                          <label htmlFor="marketing" className="text-xs text-muted-foreground leading-snug cursor-pointer">
                            Wyrażam zgodę na otrzymywanie wiadomości o nowościach, promocjach i poradach.
                          </label>
                        </div>

                        {captchaEnabled && <div ref={captchaRef} className="flex justify-center" />}
                      </>
                    )}

                    <Button
                      type="submit"
                      className="w-full gradient-bg hover:opacity-90 transition-opacity"
                      disabled={loading || (!isLogin && captchaEnabled && !captchaToken)}
                    >
                      {loading ? 'Ładowanie...' : isLogin ? 'Zaloguj się' : 'Zarejestruj się'}
                    </Button>
                  </form>

                  <div className="my-4 flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">lub</span>
                    <Separator className="flex-1" />
                  </div>

                  <Button variant="outline" className="w-full gap-2" onClick={handleGoogleSignIn}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Kontynuuj z Google
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setIsForgotPassword(false);
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? 'Nie masz konta? Zarejestruj się' : 'Masz już konto? Zaloguj się'}
            </button>
          </div>
        </motion.div>

        <div className="w-full">
          <PublicGallery />
        </div>

        <div className="w-full border-t border-border/60 pt-5">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <Link to="/blog" className="hover:text-primary transition-colors">
              Blog
            </Link>
            <span>·</span>
            <Link to="/regulamin" className="hover:text-primary transition-colors">
              Regulamin
            </Link>
            <span>·</span>
            <Link to="/polityka-prywatnosci" className="hover:text-primary transition-colors">
              Polityka prywatności
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
