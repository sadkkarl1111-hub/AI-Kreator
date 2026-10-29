import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Mail, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { vpsFetch } from '@/lib/vpsApi';

type MailerLiteGroup = {
  id: string;
  name: string;
  active_count?: number;
};

type PackageGroupMapping = {
  package_id: string;
  group_id: string;
  group_name: string;
};

type CreditPackage = {
  id: string;
  label: string;
  active: boolean;
  credits?: number;
};

type MailerLiteConfigResponse = {
  packages?: CreditPackage[];
  mappings?: PackageGroupMapping[];
  groups?: MailerLiteGroup[];
  connected?: boolean;
  savedApiKey?: string;
  connectionError?: string | null;
};

const mailerLiteAction = (body: Record<string, unknown>) =>
  vpsFetch<MailerLiteConfigResponse>('/admin/mailerlite/actions', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export function AdminMailerLite() {
  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState('');
  const [groups, setGroups] = useState<MailerLiteGroup[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [mappings, setMappings] = useState<PackageGroupMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(false);
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await mailerLiteAction({ action: 'load_config' });
      setPackages(data.packages || []);
      setMappings(data.mappings || []);
      setGroups(data.groups || []);
      setConnected(!!data.connected);
      setSavedApiKey(data.savedApiKey || '');

      if (data.savedApiKey && data.connectionError) {
        toast.error(data.connectionError);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Nie udało się pobrać konfiguracji MailerLite');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async (key?: string) => {
    setFetchingGroups(true);
    try {
      const data = await mailerLiteAction({ action: 'fetch_groups', apiKey: key || apiKey });
      setGroups(data.groups || []);
      setConnected(true);
      setSavedApiKey(data.savedApiKey || savedApiKey || 'configured');
    } catch (error: any) {
      toast.error(error?.message || 'Nie udało się pobrać grup MailerLite');
      setConnected(false);
    } finally {
      setFetchingGroups(false);
    }
  };

  const handleSaveApiKey = async () => {
    const key = apiKey.trim();
    if (!key) {
      toast.error('Wpisz klucz API');
      return;
    }

    setSavingKey(true);
    try {
      const data = await mailerLiteAction({ action: 'save_config', apiKey: key });
      setSavedApiKey(data.savedApiKey || 'configured');
      setGroups(data.groups || []);
      setConnected(true);
      setApiKey('');
      toast.success('Klucz API zapisany');
    } catch (error: any) {
      toast.error(error?.message || 'Nie udało się zapisać klucza');
    } finally {
      setSavingKey(false);
    }
  };

  const handleMappingChange = (packageId: string, groupId: string) => {
    const group = groups.find((item) => item.id === groupId);
    setMappings((prev) => {
      const withoutCurrent = prev.filter((mapping) => mapping.package_id !== packageId);
      if (!groupId) return withoutCurrent;

      return [
        ...withoutCurrent,
        {
          package_id: packageId,
          group_id: groupId,
          group_name: group?.name || '',
        },
      ];
    });
  };

  const handleSaveMappings = async () => {
    setSavingMappings(true);
    try {
      const toSave = mappings.filter((mapping) => mapping.group_id);
      const data = await mailerLiteAction({ action: 'save_mappings', mappings: toSave });
      setMappings(data.mappings || toSave);
      toast.success('Przypisania grup zapisane');
    } catch (error: any) {
      toast.error(error?.message || 'Nie udało się zapisać przypisań');
    } finally {
      setSavingMappings(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" /> MailerLite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" /> Konfiguracja MailerLite
          </CardTitle>
          <CardDescription>
            Podaj klucz API z MailerLite, aby automatycznie dodawać kontakty do grup po zakupie pakietów.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={connected ? 'default' : 'secondary'} className="gap-1">
              {connected ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {connected ? 'Połączono' : 'Niepołączono'}
            </Badge>
            {savedApiKey && !connected && (
              <span className="text-xs text-muted-foreground">Klucz jest zapisany, ale nie udało się pobrać grup.</span>
            )}
          </div>

          <div className="space-y-2">
            <Label>Klucz API MailerLite</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={savedApiKey ? 'Nowy klucz API lub zostaw puste' : 'Wklej klucz API MailerLite'}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSaveApiKey} disabled={savingKey} className="gap-1">
                <Save className="w-4 h-4" />
                {savingKey ? 'Zapisuję...' : 'Zapisz'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Znajdziesz go w MailerLite: Integrations &gt; API &gt; Developer API.
            </p>
          </div>

          {(connected || savedApiKey) && (
            <Button variant="outline" size="sm" onClick={() => fetchGroups()} disabled={fetchingGroups} className="gap-1">
              <RefreshCw className={`w-4 h-4 ${fetchingGroups ? 'animate-spin' : ''}`} />
              Odśwież grupy ({groups.length})
            </Button>
          )}
        </CardContent>
      </Card>

      {connected && groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Przypisanie grup do pakietów</CardTitle>
            <CardDescription>
              Wybierz grupę MailerLite dla każdego pakietu kredytów. Po zakupie pakietu kontakt zostanie dodany do wybranej grupy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {packages.map((pkg) => {
              const currentMapping = mappings.find((mapping) => mapping.package_id === pkg.id);
              return (
                <div
                  key={pkg.id}
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border ${
                    pkg.active ? 'border-border' : 'border-border/50 opacity-60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{pkg.label}</span>
                      {!pkg.active && (
                        <Badge variant="secondary" className="text-xs">
                          Nieaktywny
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">ID: {pkg.id}</span>
                  </div>
                  <Select
                    value={currentMapping?.group_id || 'none'}
                    onValueChange={(value) => handleMappingChange(pkg.id, value === 'none' ? '' : value)}
                  >
                    <SelectTrigger className="w-full sm:w-[280px]">
                      <SelectValue placeholder="Wybierz grupę..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Brak grupy</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name} ({group.active_count ?? 0} kontaktów)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}

            <Button onClick={handleSaveMappings} disabled={savingMappings} className="gap-1">
              <Save className="w-4 h-4" />
              {savingMappings ? 'Zapisuję...' : 'Zapisz przypisania'}
            </Button>
          </CardContent>
        </Card>
      )}

      {connected && groups.length === 0 && !fetchingGroups && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Nie znaleziono grup w MailerLite. Utwórz grupę w panelu MailerLite i odśwież.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
