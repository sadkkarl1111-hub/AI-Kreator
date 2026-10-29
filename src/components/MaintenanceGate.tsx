import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, CalendarRange, Clock3, ShieldAlert, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { vpsFetch, vpsPublicFetch } from '@/lib/vpsApi';

type MaintenanceGateProps = {
  children: ReactNode;
};

type MaintenanceSettingsResponse = {
  ok?: boolean;
  settings?: Record<string, string>;
};

type AdminAccessResponse = {
  ok?: boolean;
  allowedTabs?: string[];
  isSuperAdmin?: boolean;
};

type MaintenanceSettings = {
  enabled: boolean;
  start: string;
  end: string;
};

const MAINTENANCE_BYPASS_QUERY_KEY = 'maintenance_bypass';
const MAINTENANCE_BYPASS_QUERY_VALUE = '1';
const REFRESH_INTERVAL_MS = 180_000;

const EMPTY_SETTINGS: MaintenanceSettings = {
  enabled: false,
  start: '',
  end: '',
};

const formatMaintenanceDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Warsaw',
  }).format(date);
};

const resolveMaintenanceActivity = (settings: MaintenanceSettings) => {
  if (!settings.enabled) {
    return false;
  }

  const now = Date.now();
  const startTimestamp = settings.start ? Date.parse(settings.start) : null;
  const endTimestamp = settings.end ? Date.parse(settings.end) : null;

  if (startTimestamp && Number.isFinite(startTimestamp) && now < startTimestamp) {
    return false;
  }

  if (endTimestamp && Number.isFinite(endTimestamp) && now >= endTimestamp) {
    return false;
  }

  return true;
};

const getMaintenanceWindowLabel = (settings: MaintenanceSettings) => {
  const startLabel = settings.start ? formatMaintenanceDateTime(settings.start) : null;
  const endLabel = settings.end ? formatMaintenanceDateTime(settings.end) : null;

  if (startLabel && endLabel) {
    return `Przerwa trwa od ${startLabel} do ${endLabel} (czas polski).`;
  }

  if (startLabel) {
    return `Przerwa techniczna rozpoczela sie ${startLabel} (czas polski).`;
  }

  if (endLabel) {
    return `Planowane zakonczenie prac: ${endLabel} (czas polski).`;
  }

  return 'Przerwa techniczna trwa. Wroc prosze za chwile.';
};

function MaintenanceScreen({ settings }: { settings: MaintenanceSettings }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(217,70,239,0.12),_transparent_36%),linear-gradient(180deg,_rgba(248,250,252,1)_0%,_rgba(245,243,255,0.9)_100%)]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[-5rem] top-20 h-64 w-64 rounded-full bg-fuchsia-400/15 blur-3xl" />
        <div className="absolute right-[-4rem] top-16 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-white/60 bg-white/85 p-8 shadow-[0_30px_80px_rgba(91,33,182,0.10)] backdrop-blur xl:p-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-2 text-sm font-medium text-fuchsia-700">
              <ShieldAlert className="h-4 w-4" />
              Tryb konserwacji
            </div>

            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Wracamy za chwile z odswiezona wersja serwisu
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Prowadzimy zaplanowane prace techniczne, aby aplikacja dzialala szybciej i stabilniej. W tym czasie generowanie
                i korzystanie z panelu dla zwyklych uzytkownikow jest chwilowo wstrzymane.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <CalendarRange className="h-4 w-4 text-fuchsia-600" />
                  Okno prac
                </div>
                <p className="text-sm leading-6 text-slate-600">{getMaintenanceWindowLabel(settings)}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Clock3 className="h-4 w-4 text-sky-600" />
                  Co dalej?
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  Po zakonczeniu prac serwis wlaczy sie automatycznie. Nie trzeba odswiezac niczego poza zwyklym ponownym wejsciem na strone.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="gap-2 rounded-full px-6">
                <Link to="/">
                  Sprawdz ponownie
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="rounded-full px-6">
                <Link to={`/auth?${MAINTENANCE_BYPASS_QUERY_KEY}=${MAINTENANCE_BYPASS_QUERY_VALUE}`}>
                  Wejscie administratora
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Link administratora sluzy do wejscia do panelu podczas prac serwisowych. Zwykli uzytkownicy po zalogowaniu nadal zobacza ten ekran.
            </p>
          </section>

          <aside className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-slate-950 p-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] xl:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(217,70,239,0.20),_transparent_45%,_rgba(14,165,233,0.22)_100%)]" />
            <div className="relative">
              <div className="mx-auto mb-8 flex h-52 w-52 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                <div className="relative flex h-36 w-36 items-center justify-center rounded-[2rem] border border-white/10 bg-white/10">
                  <div className="absolute -top-4 -right-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-500 shadow-lg shadow-fuchsia-500/25">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <div className="grid gap-3">
                    <div className="h-3 w-24 rounded-full bg-white/70" />
                    <div className="h-3 w-20 rounded-full bg-sky-300/80" />
                    <div className="h-3 w-28 rounded-full bg-fuchsia-300/80" />
                    <div className="h-3 w-16 rounded-full bg-white/45" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Prace techniczne w toku</h2>
                <p className="text-sm leading-6 text-slate-300">
                  Aktualizujemy kluczowe elementy aplikacji, aby po powrocie wszystko bylo gotowe do dalszej pracy bez niespodzianek.
                </p>
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-300">Status</span>
                    <span className="rounded-full bg-amber-400/15 px-3 py-1 text-amber-200">Konserwacja aktywna</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,_#d946ef,_#38bdf8)]" />
                  </div>
                  <p className="text-xs leading-5 text-slate-400">
                    Jesli to pilna sprawa administracyjna, skorzystaj z wejscia administratora i zaloguj sie na konto z uprawnieniami admina.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function MaintenanceGate({ children }: MaintenanceGateProps) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [settings, setSettings] = useState<MaintenanceSettings>(EMPTY_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [adminBypass, setAdminBypass] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  const bypassRequested = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(MAINTENANCE_BYPASS_QUERY_KEY) === MAINTENANCE_BYPASS_QUERY_VALUE;
  }, [location.search]);

  const pathIsAlwaysAllowed = location.pathname === '/auth/callback';
  const pathUsesAdminBypass = location.pathname === '/auth' && bypassRequested;
  const pathIsExempt = pathIsAlwaysAllowed || pathUsesAdminBypass;
  const maintenanceActive = useMemo(() => resolveMaintenanceActivity(settings), [settings]);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const data = await vpsPublicFetch<MaintenanceSettingsResponse>(
          '/public/settings?keys=maintenance_mode_enabled,maintenance_mode_start,maintenance_mode_end',
          { cache: 'no-store' },
        );

        if (cancelled) return;

        const publicSettings = data.settings || {};
        setSettings({
          enabled: publicSettings.maintenance_mode_enabled === 'true',
          start: publicSettings.maintenance_mode_start || '',
          end: publicSettings.maintenance_mode_end || '',
        });
      } catch {
        if (cancelled) return;
        setSettings(EMPTY_SETTINGS);
      } finally {
        if (!cancelled) {
          setSettingsLoaded(true);
        }
      }
    };

    void loadSettings();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadSettings();
    }, REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      if (document.visibilityState !== 'visible') return;
      void loadSettings();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadSettings();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!maintenanceActive || !userId) {
      setAdminBypass(false);
      setCheckingAdmin(false);
      return;
    }

    let cancelled = false;
    setCheckingAdmin(true);

    vpsFetch<AdminAccessResponse>('/me/admin-access')
      .then((data) => {
        if (cancelled) return;
        setAdminBypass(Boolean(data.isSuperAdmin) || Boolean(data.allowedTabs?.length));
      })
      .catch(() => {
        if (cancelled) return;
        setAdminBypass(false);
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingAdmin(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [maintenanceActive, userId]);

  const shouldWaitForAdminBypass =
    settingsLoaded && maintenanceActive && (authLoading || (user && checkingAdmin)) && !pathIsExempt;

  if (shouldWaitForAdminBypass) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="space-y-3">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">Przygotowujemy widok serwisu...</p>
        </div>
      </div>
    );
  }

  if (!settingsLoaded || !maintenanceActive || pathIsExempt || adminBypass) {
    return <>{children}</>;
  }

  return <MaintenanceScreen settings={settings} />;
}
