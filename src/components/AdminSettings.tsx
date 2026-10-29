import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AdminPayments } from '@/components/AdminStripe';
import { AdminMailerLite } from '@/components/AdminMailerLite';
import { toast } from 'sonner';
import { Shield, Mail, Cookie, Save, Eye, EyeOff, FileText, Globe, CreditCard, Coins } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { vpsFetch } from '@/lib/vpsApi';

type Settings = Record<string, string>;

type AdminSettingsResponse = {
  ok?: boolean;
  error?: string;
  settings?: Array<{ key: string; value: string }>;
};

type AdminStorageMigrationResponse = {
  ok?: boolean;
  error?: string;
  graphicsScanned?: number;
  graphicsMigrated?: number;
  badgesScanned?: number;
  badgesMigrated?: number;
};

type AdminCoreDataMigrationResponse = {
  ok?: boolean;
  error?: string;
  skipped?: boolean;
  siteSettings?: number;
  siteContent?: number;
  emailTemplates?: number;
  aiModels?: number;
  toolPricing?: number;
};

type AdminDailyCreditsRunResponse = {
  ok?: boolean;
  error?: string;
  skipped?: boolean;
  updatedUsers?: number;
  runDate?: string;
  creditsAddedPerUser?: number;
  balanceCap?: number;
};

type AdminSettingsProps = {
  showCoreSettings?: boolean;
  showStripe?: boolean;
  showMailerLite?: boolean;
};

const TRIMMED_SETTING_KEYS = new Set([
  'app_base_url',
  'app_generator_url',
  'app_reset_password_url',
  'google_oauth_client_id',
  'google_oauth_client_secret',
  'captcha_site_key',
  'captcha_secret_key',
  'email_from',
  'email_webhook_url',
  'email_webhook_token',
  'maintenance_mode_start',
  'maintenance_mode_end',
  'resend_api_key',
  'ksef_nip',
  'ksef_token',
]);

const toDateTimeLocalInput = (value: string) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const fromDateTimeLocalInput = (value: string) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
};

const getMaintenanceStateLabel = (enabled: boolean, startValue: string, endValue: string) => {
  if (!enabled) return 'Tryb konserwacji jest obecnie wylaczony.';

  const now = Date.now();
  const startTimestamp = startValue ? Date.parse(startValue) : null;
  const endTimestamp = endValue ? Date.parse(endValue) : null;

  if (startTimestamp && Number.isFinite(startTimestamp) && now < startTimestamp) {
    return 'Konserwacja jest zaplanowana i wlaczy sie automatycznie o ustawionej godzinie.';
  }

  if (endTimestamp && Number.isFinite(endTimestamp) && now >= endTimestamp) {
    return 'Okno konserwacyjne juz minelo. Strona nie bedzie blokowana, dopoki nie ustawisz nowego terminu.';
  }

  return 'Tryb konserwacji jest aktywny dla uzytkownikow. Zalogowany admin zachowuje dostep do panelu.';
};

export function AdminSettings({
  showCoreSettings = true,
  showStripe = true,
  showMailerLite = true,
}: AdminSettingsProps) {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migratingStorage, setMigratingStorage] = useState(false);
  const [migratingCoreData, setMigratingCoreData] = useState(false);
  const [runningDailyCredits, setRunningDailyCredits] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await vpsFetch<AdminSettingsResponse>('/admin/settings/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list' }),
      });
      const rows = data.settings || [];
      const map: Settings = {};
      rows.forEach((row: { key: string; value: string }) => {
        map[row.key] = row.value;
      });

      setSettings(map);
      setLoading(false);
    } catch {
      toast.error('Nie udalo sie zaladowac ustawien');
      return;
    }
  };

  const normalizeValue = (key: string, value: string) => {
    if (TRIMMED_SETTING_KEYS.has(key)) {
      return value.trim();
    }
    return value;
  };

  const saveSettingsBatch = async (
    entries: Array<[string, string]>,
    successMessage: string | null = 'Zapisano!'
  ) => {
    setSaving(true);

    const normalizedEntries = entries.map(([key, value]) => [key, normalizeValue(key, value)] as const);
    try {
      await vpsFetch<AdminSettingsResponse>('/admin/settings/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'upsert', entries: normalizedEntries }),
      });
    } catch {
      toast.error('Blad zapisu ustawien');
      setSaving(false);
      return false;
    }

    setSettings((prev) => {
      const next = { ...prev };
      normalizedEntries.forEach(([key, value]) => {
        next[key] = value;
      });
      return next;
    });

    if (successMessage) {
      toast.success(successMessage);
    }
    setSaving(false);
    return true;
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const migrateStorageToVps = async () => {
    setMigratingStorage(true);

    try {
      const data = await vpsFetch<AdminStorageMigrationResponse>('/admin/settings/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'migrate_storage' }),
      });

      toast.success(
        `Migracja zakonczona. Grafiki: ${data.graphicsMigrated || 0}/${data.graphicsScanned || 0}, badge'e: ${data.badgesMigrated || 0}/${data.badgesScanned || 0}.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udalo sie uruchomic migracji plikow.');
    } finally {
      setMigratingStorage(false);
    }
  };

  const migrateCoreDataToVps = async () => {
    setMigratingCoreData(true);

    try {
      const data = await vpsFetch<AdminCoreDataMigrationResponse>('/admin/settings/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'migrate_core_data' }),
      });

      if (data.skipped) {
        toast.success('Dane konfiguracyjne byly juz zsynchronizowane z VPS.');
        return;
      }

      toast.success(
        `Migracja danych zakonczona. Ustawienia: ${data.siteSettings || 0}, tresci: ${data.siteContent || 0}, szablony email: ${data.emailTemplates || 0}, modele AI: ${data.aiModels || 0}, cennik narzedzi: ${data.toolPricing || 0}.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udalo sie uruchomic migracji danych konfiguracyjnych.');
    } finally {
      setMigratingCoreData(false);
    }
  };

  const emailProvider = settings.email_provider || 'resend';
  const ksefEnabled = (settings.ksef_enabled || 'true') === 'true';
  const maintenanceEnabled = (settings.maintenance_mode_enabled || 'false') === 'true';
  const dailyFreeCreditsAmount = settings.daily_free_credits_amount || '5';
  const dailyFreeCreditsBalanceCap = settings.daily_free_credits_balance_cap || '200';
  const canShowIntegrations = showStripe || showMailerLite;
  const appBaseUrl = (settings.app_base_url || '').trim().replace(/\/+$/, '');
  const googleCallbackUrl = `${appBaseUrl || 'https://twojadomena.pl'}/auth/callback`;
  const maintenanceStart = settings.maintenance_mode_start || '';
  const maintenanceEnd = settings.maintenance_mode_end || '';

  const normalizeDailyCreditsSettings = () => {
    const parsedAmount = Number.parseInt(dailyFreeCreditsAmount, 10);
    const parsedBalanceCap = Number.parseInt(dailyFreeCreditsBalanceCap, 10);

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      toast.error('Dzienna liczba kredytow musi byc liczba 0 lub wieksza.');
      return null;
    }

    if (!Number.isFinite(parsedBalanceCap) || parsedBalanceCap < parsedAmount) {
      toast.error('Limit salda musi byc liczba rowna lub wieksza od dziennej paczki kredytow.');
      return null;
    }

    return {
      amount: String(parsedAmount),
      balanceCap: String(parsedBalanceCap),
    };
  };

  const saveMaintenanceSettings = async () => {
    const normalizedStart = maintenanceStart.trim();
    const normalizedEnd = maintenanceEnd.trim();

    if (normalizedStart && normalizedEnd) {
      const startTimestamp = Date.parse(normalizedStart);
      const endTimestamp = Date.parse(normalizedEnd);

      if (!Number.isNaN(startTimestamp) && !Number.isNaN(endTimestamp) && startTimestamp >= endTimestamp) {
        toast.error('Data zakonczenia musi byc pozniejsza niz data rozpoczecia.');
        return;
      }
    }

    await saveSettingsBatch([
      ['maintenance_mode_enabled', maintenanceEnabled ? 'true' : 'false'],
      ['maintenance_mode_start', normalizedStart],
      ['maintenance_mode_end', normalizedEnd],
    ], 'Zapisano ustawienia trybu konserwacji');
  };

  const saveDailyCreditsSettings = async (successMessage = 'Zapisano ustawienia dziennych kredytow') => {
    const normalized = normalizeDailyCreditsSettings();
    if (!normalized) return null;

    const saved = await saveSettingsBatch([
      ['daily_free_credits_amount', normalized.amount],
      ['daily_free_credits_balance_cap', normalized.balanceCap],
    ], successMessage);

    if (!saved) return null;

    return normalized;
  };

  const runDailyCreditsNow = async () => {
    const normalized = await saveDailyCreditsSettings(null);
    if (!normalized) return;

    setRunningDailyCredits(true);

    try {
      const data = await vpsFetch<AdminDailyCreditsRunResponse>('/admin/settings/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'run_daily_credits' }),
      });

      if (data.skipped) {
        toast.success(
          `Dzienne kredyty byly juz dzisiaj naliczone. Paczka: ${normalized.amount} kr, limit salda: ${normalized.balanceCap} kr.`
        );
        return;
      }

      toast.success(
        `Dodano ${normalized.amount} kr dla ${data.updatedUsers || 0} uzytkownikow. Limit salda: ${normalized.balanceCap} kr.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udalo sie uruchomic dziennych kredytow.');
    } finally {
      setRunningDailyCredits(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Ladowanie ustawien...</div>;
  }

  if (!showCoreSettings && !canShowIntegrations) {
    return <div className="text-muted-foreground text-sm">Brak dostepnych ustawien dla tego konta.</div>;
  }

  return (
    <div className="space-y-6">
      {showCoreSettings && (
        <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5" /> Captcha (antybot)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Dostawca captcha</Label>
            <Select
              value={settings.captcha_provider || 'recaptcha'}
              onValueChange={(value) => handleChange('captcha_provider', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="turnstile">Cloudflare Turnstile</SelectItem>
                <SelectItem value="recaptcha">Google reCAPTCHA v2</SelectItem>
                <SelectItem value="hcaptcha">hCaptcha</SelectItem>
                <SelectItem value="none">Wylaczona</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.captcha_provider !== 'none' && (
            <>
              <div className="space-y-2">
                <Label>Site Key (publiczny)</Label>
                <Input
                  value={settings.captcha_site_key || ''}
                  onChange={(e) => handleChange('captcha_site_key', e.target.value)}
                  placeholder="Wklej site key..."
                />
              </div>
              <div className="space-y-2">
                <Label>Secret Key (prywatny)</Label>
                <div className="flex gap-2">
                  <Input
                    type={showSecrets.captcha_secret_key ? 'text' : 'password'}
                    value={settings.captcha_secret_key || ''}
                    onChange={(e) => handleChange('captcha_secret_key', e.target.value)}
                    placeholder="Wklej secret key..."
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleSecret('captcha_secret_key')}
                  >
                    {showSecrets.captcha_secret_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}

          <Button
            onClick={() => saveSettingsBatch([
              ['captcha_provider', settings.captcha_provider || 'recaptcha'],
              ['captcha_site_key', settings.captcha_site_key || ''],
              ['captcha_secret_key', settings.captcha_secret_key || ''],
            ], 'Zapisano ustawienia captcha')}
            disabled={saving}
            className="gap-2"
          >
            <Save className="w-4 h-4" /> Zapisz ustawienia captcha
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-5 h-5" /> Aplikacja / VPS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Adres aplikacji</Label>
            <Input
              value={settings.app_base_url || ''}
              onChange={(e) => handleChange('app_base_url', e.target.value)}
              placeholder="https://twojadomena.pl"
            />
            <p className="text-xs text-muted-foreground">
              Bazowy adres frontendu po przeniesieniu na VPS. Ten adres jest uzywany tez przez logowanie Google i linki powrotne z emaili.
            </p>
          </div>

          <div className="space-y-2">
            <Label>URL generatora (opcjonalnie)</Label>
            <Input
              value={settings.app_generator_url || ''}
              onChange={(e) => handleChange('app_generator_url', e.target.value)}
              placeholder="https://twojadomena.pl/generator"
            />
          </div>

          <div className="space-y-2">
            <Label>URL resetu hasla (opcjonalnie)</Label>
            <Input
              value={settings.app_reset_password_url || ''}
              onChange={(e) => handleChange('app_reset_password_url', e.target.value)}
              placeholder="https://twojadomena.pl/reset-password"
            />
            <p className="text-xs text-muted-foreground">
              Jesli pola URL zostawisz puste, system zbuduje je automatycznie z adresu aplikacji.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Google / VPS OAuth</p>
            <p className="text-xs text-muted-foreground">
              Wpisz tu prawdziwy adres strony, a backend VPS zbuduje z niego wlasny callback Google bez przechodzenia przez zewnetrzny auth provider.
            </p>
            <div className="space-y-1 text-xs">
              <p>
                <span className="font-medium">Google JavaScript origin:</span>{' '}
                <span className="font-mono break-all">{appBaseUrl || 'https://twojadomena.pl'}</span>
              </p>
              <p>
                <span className="font-medium">Google redirect URI:</span>{' '}
                <span className="font-mono break-all">{googleCallbackUrl}</span>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Google Client ID</Label>
            <Input
              value={settings.google_oauth_client_id || ''}
              onChange={(e) => handleChange('google_oauth_client_id', e.target.value)}
              placeholder="1234567890-xxxxx.apps.googleusercontent.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Google Client Secret</Label>
            <div className="flex gap-2">
              <Input
                type={showSecrets.google_oauth_client_secret ? 'text' : 'password'}
                value={settings.google_oauth_client_secret || ''}
                onChange={(e) => handleChange('google_oauth_client_secret', e.target.value)}
                placeholder="GOCSPX-..."
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => toggleSecret('google_oauth_client_secret')}
              >
                {showSecrets.google_oauth_client_secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Te pola sa teraz uzywane przez wlasny backend VPS do logowania Google. Po poprawnym wdrozeniu callback dziala w pelni po stronie VPS.
            </p>
          </div>

          <Button
            onClick={() => saveSettingsBatch([
              ['app_base_url', settings.app_base_url || ''],
              ['app_generator_url', settings.app_generator_url || ''],
              ['app_reset_password_url', settings.app_reset_password_url || ''],
              ['google_oauth_client_id', settings.google_oauth_client_id || ''],
              ['google_oauth_client_secret', settings.google_oauth_client_secret || ''],
            ], 'Zapisano ustawienia aplikacji')}
            disabled={saving}
            className="gap-2"
          >
            <Save className="w-4 h-4" /> Zapisz ustawienia aplikacji
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5" /> Tryb konserwacji
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-1">
              <Label htmlFor="maintenance-mode-enabled">Wlacz strone konserwacyjna</Label>
              <p className="text-xs text-muted-foreground">
                Po aktywacji zwykli uzytkownicy zobacza ekran przerwy technicznej z terminem prac. Admin zachowuje dostep do panelu.
              </p>
            </div>
            <Switch
              id="maintenance-mode-enabled"
              checked={maintenanceEnabled}
              onCheckedChange={(checked) => handleChange('maintenance_mode_enabled', checked ? 'true' : 'false')}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data i godzina rozpoczecia</Label>
              <Input
                type="datetime-local"
                value={toDateTimeLocalInput(maintenanceStart)}
                onChange={(e) => handleChange('maintenance_mode_start', fromDateTimeLocalInput(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Jesli zostawisz puste, blokada moze wlaczyc sie od razu po zapisaniu.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Data i godzina zakonczenia</Label>
              <Input
                type="datetime-local"
                value={toDateTimeLocalInput(maintenanceEnd)}
                onChange={(e) => handleChange('maintenance_mode_end', fromDateTimeLocalInput(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Jesli zostawisz puste, przerwa bedzie trwac do momentu recznego wylaczenia.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Podglad dzialania</p>
            <p className="text-xs text-muted-foreground">
              {getMaintenanceStateLabel(maintenanceEnabled, maintenanceStart, maintenanceEnd)}
            </p>
            <p className="text-xs text-muted-foreground">
              Wejscie awaryjne dla administratora pozostaje dostepne z poziomu logowania.
            </p>
          </div>

          <Button
            onClick={saveMaintenanceSettings}
            disabled={saving}
            className="gap-2"
          >
            <Save className="w-4 h-4" /> Zapisz tryb konserwacji
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="w-5 h-5" /> Dzienne kredyty
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Liczba kredytow dziennie</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={dailyFreeCreditsAmount}
                onChange={(e) => handleChange('daily_free_credits_amount', e.target.value)}
                placeholder="5"
              />
              <p className="text-xs text-muted-foreground">
                Tyle kredytow system doda automatycznie kazdemu uzytkownikowi raz dziennie.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Limit salda po auto-dodaniu</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={dailyFreeCreditsBalanceCap}
                onChange={(e) => handleChange('daily_free_credits_balance_cap', e.target.value)}
                placeholder="200"
              />
              <p className="text-xs text-muted-foreground">
                Automat nie podniesie salda ponad ten limit. Ustaw wyzej na eventy z wieksza pula.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Jak to dziala na VPS</p>
            <p className="text-xs text-muted-foreground">
              Backend sprawdza naliczenie automatycznie co 30 minut i dodatkowo przy odswiezaniu salda uzytkownika.
              Dzieki temu kredyty nie sa juz zalezne od zewnetrznego crona.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void saveDailyCreditsSettings()}
              disabled={saving || runningDailyCredits}
              className="gap-2"
            >
              <Save className="w-4 h-4" /> Zapisz dzienne kredyty
            </Button>
            <Button
              variant="outline"
              onClick={runDailyCreditsNow}
              disabled={saving || runningDailyCredits}
              className="gap-2"
            >
              <Coins className="w-4 h-4" />
              {runningDailyCredits ? 'Trwa naliczanie...' : 'Nalicz teraz wszystkim'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5" /> Migracja plikow na VPS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Przenies stare grafiki i badge&apos;e z poprzedniego storage</p>
            <p className="text-xs text-muted-foreground">
              Ta akcja kopiuje historyczne pliki do lokalnego storage na VPS i przepina rekordy w bazie na lokalne sciezki.
              Nie usuwa jeszcze plikow z poprzedniego storage, wiec migracja jest bezpieczna i odwra calna.
            </p>
          </div>

          <Button
            onClick={migrateStorageToVps}
            disabled={migratingStorage}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {migratingStorage ? 'Trwa migracja plikow...' : 'Migruj pliki do VPS'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5" /> Migracja danych konfiguracyjnych do VPS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Przenies ustawienia, modele, tresci, szablony email i cennik narzedzi do lokalnej bazy VPS</p>
            <p className="text-xs text-muted-foreground">
              Ten krok tworzy lokalna kopie danych konfiguracyjnych w PostgreSQL na VPS. Dzięki temu backend VPS moze czytac je lokalnie, zamiast odpytywac zewnetrzne uslugi przy kazdym requestcie.
            </p>
          </div>

          <Button
            onClick={migrateCoreDataToVps}
            disabled={migratingCoreData}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {migratingCoreData ? 'Trwa migracja danych...' : 'Migruj dane konfiguracyjne do VPS'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-5 h-5" /> Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Dostawca wysylki</Label>
            <Select
              value={emailProvider}
              onValueChange={(value) => handleChange('email_provider', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="webhook">VPS webhook</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Resend jest najprostszy teraz. VPS webhook pozwala pozniej szybko przelaczyc wysylke na wlasny backend.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Adres nadawcy</Label>
            <Input
              value={settings.email_from || ''}
              onChange={(e) => handleChange('email_from', e.target.value)}
              placeholder="Kreator Grafik AI <noreply@twojadomena.pl>"
            />
          </div>

          {emailProvider === 'resend' && (
            <div className="space-y-2">
              <Label>Resend API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showSecrets.resend_api_key ? 'text' : 'password'}
                  value={settings.resend_api_key || ''}
                  onChange={(e) => handleChange('resend_api_key', e.target.value)}
                  placeholder="re_..."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => toggleSecret('resend_api_key')}
                >
                  {showSecrets.resend_api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Zapisana wartosc nadpisuje poprzedni klucz i jest uzywana przez funkcje email.
              </p>
            </div>
          )}

          {emailProvider === 'webhook' && (
            <>
              <div className="space-y-2">
                <Label>Webhook URL VPS</Label>
                <Input
                  value={settings.email_webhook_url || ''}
                  onChange={(e) => handleChange('email_webhook_url', e.target.value)}
                  placeholder="https://twojadomena.pl/api/email/send"
                />
              </div>
              <div className="space-y-2">
                <Label>Webhook token</Label>
                <div className="flex gap-2">
                  <Input
                    type={showSecrets.email_webhook_token ? 'text' : 'password'}
                    value={settings.email_webhook_token || ''}
                    onChange={(e) => handleChange('email_webhook_token', e.target.value)}
                    placeholder="sekretny token dla VPS"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleSecret('email_webhook_token')}
                  >
                    {showSecrets.email_webhook_token ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Backend VPS wysle POST na endpoint webhook z polami `from`, `to`, `subject`, `html`.
              </p>
            </>
          )}

          <Button
            onClick={() => saveSettingsBatch([
              ['email_provider', emailProvider],
              ['email_from', settings.email_from || ''],
              ['resend_api_key', settings.resend_api_key || ''],
              ['email_webhook_url', settings.email_webhook_url || ''],
              ['email_webhook_token', settings.email_webhook_token || ''],
            ], 'Zapisano ustawienia email')}
            disabled={saving}
            className="gap-2"
          >
            <Save className="w-4 h-4" /> Zapisz ustawienia email
          </Button>
        </CardContent>
      </Card>
        </>
      )}

      {canShowIntegrations && (
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5" /> Integracje platnosci i marketingu
          </h2>
          <p className="text-sm text-muted-foreground">
            Operator platnosci i MailerLite sa teraz dostepne bezposrednio w ustawieniach panelu admina.
          </p>
        </div>

        {showStripe && <AdminPayments />}
        {showMailerLite && <AdminMailerLite />}
      </div>
      )}

      {showCoreSettings && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cookie className="w-5 h-5" /> CookieYes (baner cookies)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Script tag CookieYes</Label>
            <Textarea
              value={settings.cookieyes_script || ''}
              onChange={(e) => handleChange('cookieyes_script', e.target.value)}
              placeholder='<script id="cookieyes" ...></script>'
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Wklej caly tag {'<script>'} z panelu CookieYes.
            </p>
          </div>
          <Button
            onClick={() => saveSettingsBatch([
              ['cookieyes_script', settings.cookieyes_script || ''],
            ], 'Zapisano CookieYes')}
            disabled={saving}
            className="gap-2"
          >
            <Save className="w-4 h-4" /> Zapisz CookieYes
          </Button>
        </CardContent>
      </Card>
      )}

      {showCoreSettings && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5" /> KSeF (Krajowy System e-Faktur)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-1">
              <Label htmlFor="ksef-enabled">Wlacz KSeF</Label>
              <p className="text-xs text-muted-foreground">
                Po wylaczeniu wysylka faktur do KSeF zostanie zablokowana w panelu zakupow i na backendzie.
              </p>
            </div>
            <Switch
              id="ksef-enabled"
              checked={ksefEnabled}
              onCheckedChange={(checked) => handleChange('ksef_enabled', checked ? 'true' : 'false')}
            />
          </div>

          <div className="space-y-2">
            <Label>NIP firmy</Label>
            <Input
              value={settings.ksef_nip || ''}
              onChange={(e) => handleChange('ksef_nip', e.target.value)}
              placeholder="1234567890"
            />
          </div>

          <div className="space-y-2">
            <Label>Token KSeF</Label>
            <div className="flex gap-2">
              <Input
                type={showSecrets.ksef_token ? 'text' : 'password'}
                value={settings.ksef_token || ''}
                onChange={(e) => handleChange('ksef_token', e.target.value)}
                placeholder="20260404-EC-...|nip-...|..."
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => toggleSecret('ksef_token')}
              >
                {showSecrets.ksef_token ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Pelny token w formacie: identyfikator|nip-XXXXXXXXXX|secret_hex
            </p>
          </div>

          <div className="space-y-2">
            <Label>Srodowisko KSeF</Label>
            <Select
              value={settings.ksef_environment || 'demo'}
              onValueChange={(value) => handleChange('ksef_environment', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demo">Demo</SelectItem>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="prod">Produkcja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => saveSettingsBatch([
              ['ksef_enabled', ksefEnabled ? 'true' : 'false'],
              ['ksef_nip', settings.ksef_nip || ''],
              ['ksef_token', settings.ksef_token || ''],
              ['ksef_environment', settings.ksef_environment || 'demo'],
            ], 'Zapisano ustawienia KSeF')}
            disabled={saving}
            className="gap-2"
          >
            <Save className="w-4 h-4" /> Zapisz ustawienia KSeF
          </Button>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
