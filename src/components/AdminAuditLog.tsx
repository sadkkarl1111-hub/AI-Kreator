import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Activity, RefreshCw, Search, ShieldAlert, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { vpsFetch } from '@/lib/vpsApi';

type AdminAuditLogEntry = {
  id: string;
  event_key: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  actor_user_id: string | null;
  actor_email: string | null;
  target_user_id: string | null;
  target_email: string | null;
  ip: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type AdminAuditLogResponse = {
  ok?: boolean;
  error?: string;
  logs?: AdminAuditLogEntry[];
  deleted?: number;
};

const severityLabels: Record<AdminAuditLogEntry['severity'], string> = {
  info: 'Info',
  warning: 'Ważne',
  critical: 'Krytyczne',
};

const severityClasses: Record<AdminAuditLogEntry['severity'], string> = {
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pl-PL');
};

const stringifyDetails = (details: Record<string, unknown> | null) => {
  if (!details || !Object.keys(details).length) return '';
  return JSON.stringify(details, null, 2);
};

export function AdminAuditLog() {
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const [retentionDays, setRetentionDays] = useState('180');
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async (options: { silent?: boolean } = {}) => {
    if (options.silent) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await vpsFetch<AdminAuditLogResponse>('/admin/audit-log/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: 'list',
          search,
          severity,
          limit: 500,
        }),
      });
      setLogs(data.logs || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się pobrać historii działań');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchLogs();
    }, 250);

    return () => window.clearTimeout(handle);
  }, [search, severity]);

  const stats = useMemo(() => {
    const now = Date.now();
    const last24h = logs.filter((log) => now - new Date(log.created_at).getTime() < 24 * 60 * 60 * 1000).length;
    const critical = logs.filter((log) => log.severity === 'critical').length;
    const uniqueActors = new Set(logs.map((log) => log.actor_email || log.actor_user_id).filter(Boolean)).size;
    return { total: logs.length, last24h, critical, uniqueActors };
  }, [logs]);

  const handleClearOld = async () => {
    const days = Math.max(1, Number(retentionDays) || 180);
    setClearing(true);
    try {
      const data = await vpsFetch<AdminAuditLogResponse>('/admin/audit-log/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'clear_old', retentionDays: days }),
      });
      toast.success(`Usunięto ${data.deleted || 0} wpisów starszych niż ${days} dni`);
      await fetchLogs({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wyczyścić historii');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Wpisy</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ostatnie 24h</p>
            <p className="text-2xl font-bold">{stats.last24h}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Krytyczne</p>
            <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Administratorzy</p>
            <p className="text-2xl font-bold">{stats.uniqueActors}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" /> Historia działań admina
              </CardTitle>
              <CardDescription>Kto, kiedy, z jakiego IP i co zmienił w panelu.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={refreshing} onClick={() => fetchLogs({ silent: true })}>
                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Odśwież
              </Button>
              <Input
                value={retentionDays}
                onChange={(event) => setRetentionDays(event.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-24"
                inputMode="numeric"
                aria-label="Liczba dni retencji"
              />
              <Button variant="destructive" size="sm" disabled={clearing} onClick={handleClearOld}>
                <Trash2 className="w-4 h-4 mr-1" /> Usuń stare
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Szukaj po mailu, IP, akcji albo szczegółach..."
                className="pl-9"
              />
            </div>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie poziomy</SelectItem>
                <SelectItem value="critical">Krytyczne</SelectItem>
                <SelectItem value="warning">Ważne</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              <ShieldAlert className="mx-auto mb-2 h-8 w-8" />
              Brak wpisów historii dla wybranych filtrów.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const detailsText = stringifyDetails(log.details);
                return (
                  <div key={log.id} className="rounded-xl border bg-card p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={severityClasses[log.severity]}>
                            {severityLabels[log.severity] || log.severity}
                          </Badge>
                          <h3 className="font-semibold">{log.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">{log.event_key}</p>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</p>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Kto</p>
                        <p className="font-medium break-all">{log.actor_email || log.actor_user_id || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cel</p>
                        <p className="font-medium break-all">{log.target_email || log.target_user_id || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">IP</p>
                        <p className="font-medium break-all">{log.ip || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Przeglądarka</p>
                        <p className="font-medium truncate" title={log.user_agent || ''}>{log.user_agent || '-'}</p>
                      </div>
                    </div>

                    {detailsText && (
                      <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
                        {detailsText}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
