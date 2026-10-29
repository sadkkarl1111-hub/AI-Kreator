import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { AlertTriangle, BookOpen, Info, RefreshCw, Search, Shield, Trash2, Wrench } from 'lucide-react';
import {
  matchGuide,
  severityColors,
  severityLabels,
  severityOrder,
  sourceColors,
  sourceFilterOptions,
  sourceLabels,
  TROUBLESHOOT_GUIDES,
  VPS_CHECKLIST,
} from './adminErrorLogConfig';
import { vpsFetch } from '@/lib/vpsApi';

type ErrorLog = {
  id: string;
  user_id: string | null;
  error_type: string;
  source: string;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type AdminErrorLogsResponse = {
  ok?: boolean;
  error?: string;
  logs?: ErrorLog[];
};

const LOGGED_SOURCE_KEYS = ['frontend', 'generate-image', 'edit-image', 'create-checkout'] as const;

export function AdminErrorLogs() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [clearing, setClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'guides' | 'checklist'>('logs');
  const [retentionDays, setRetentionDays] = useState('30');

  const fetchLogs = async () => {
    setLoading(true);

    try {
      const data = await vpsFetch<AdminErrorLogsResponse>('/admin/error-logs/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list', source: sourceFilter }),
      });
      setLogs((data.logs || []) as ErrorLog[]);
    } catch {
      toast.error('Nie udało się pobrać logów');
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [sourceFilter]);

  const handleClearOld = async () => {
    setClearing(true);

    const days = parseInt(retentionDays, 10);
    try {
      await vpsFetch<AdminErrorLogsResponse>('/admin/error-logs/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'clear_old', retentionDays: days }),
      });
      toast.success(`Logi starsze niż ${days} dni zostały usunięte`);
      fetchLogs();
    } catch {
      toast.error('Nie udało się wyczyścić logów');
    }

    setClearing(false);
  };

  const filteredLogs = useMemo(() => {
    if (!search.trim()) {
      return logs;
    }

    const q = search.toLowerCase();
    return logs.filter((log) =>
      log.message.toLowerCase().includes(q) ||
      log.error_type.toLowerCase().includes(q) ||
      log.source.toLowerCase().includes(q) ||
      log.user_id?.toLowerCase().includes(q),
    );
  }, [logs, search]);

  const stats = useMemo(() => {
    const now = Date.now();
    const last24h = logs.filter((log) => now - new Date(log.created_at).getTime() < 86400000).length;
    const last7d = logs.filter((log) => now - new Date(log.created_at).getTime() < 7 * 86400000).length;
    const bySource: Record<string, number> = {};
    const byType: Record<string, number> = {};

    logs.forEach((log) => {
      bySource[log.source] = (bySource[log.source] || 0) + 1;
      byType[log.error_type] = (byType[log.error_type] || 0) + 1;
    });

    const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];

    return { total: logs.length, last24h, last7d, topSource, topType };
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button variant={activeTab === 'logs' ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setActiveTab('logs')}>
          <AlertTriangle className="w-4 h-4" /> Logi błędów
          {stats.total > 0 && <Badge variant="secondary" className="ml-1">{stats.total}</Badge>}
        </Button>
        <Button variant={activeTab === 'guides' ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setActiveTab('guides')}>
          <BookOpen className="w-4 h-4" /> Poradnik napraw
        </Button>
        <Button variant={activeTab === 'checklist' ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setActiveTab('checklist')}>
          <Shield className="w-4 h-4" /> Checklist VPS
        </Button>
      </div>

      {activeTab === 'logs' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Ostatnie 24h</p>
              <p className="text-2xl font-bold">{stats.last24h}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Ostatnie 7 dni</p>
              <p className="text-2xl font-bold">{stats.last7d}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Najczęstsze źródło</p>
              <p className="text-sm font-semibold truncate">
                {stats.topSource ? `${sourceLabels[stats.topSource[0]] || stats.topSource[0]} (${stats.topSource[1]})` : '-'}
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Najczęstszy typ</p>
              <p className="text-sm font-semibold truncate">
                {stats.topType ? `${stats.topType[0]} (${stats.topType[1]})` : '-'}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" /> Historia błędów
                    </CardTitle>
                    <CardDescription>Ostatnie 500 wpisów, filtrowanie po źródle i treści</CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                      <SelectTrigger className="w-[190px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie</SelectItem>
                        {sourceFilterOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={fetchLogs} title="Odśwież">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    Ta sekcja pokazuje wpisy zapisane do tabeli <span className="font-mono text-foreground">error_logs</span>.
                    Aktualnie trafiają tu logi z: {LOGGED_SOURCE_KEYS.map((source) => sourceLabels[source] || source).join(', ')}.
                  </p>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Szukaj w logach..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={retentionDays} onValueChange={setRetentionDays}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dni</SelectItem>
                      <SelectItem value="14">14 dni</SelectItem>
                      <SelectItem value="30">30 dni</SelectItem>
                      <SelectItem value="60">60 dni</SelectItem>
                      <SelectItem value="90">90 dni</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleClearOld} disabled={clearing} className="gap-1 text-destructive hover:text-destructive whitespace-nowrap">
                    <Trash2 className="w-4 h-4" /> {clearing ? '...' : `Usuń >${retentionDays} dni`}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((index) => <Skeleton key={index} className="h-16 w-full" />)}
                </div>
              ) : (
                <div className="space-y-2 max-h-[700px] overflow-y-auto">
                  {filteredLogs.map((log) => {
                    const guideKey = matchGuide(log);
                    const guide = guideKey ? TROUBLESHOOT_GUIDES[guideKey] : null;

                    return (
                      <div key={log.id} className="p-3 rounded-lg border border-border bg-card text-sm">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant="outline" className={sourceColors[log.source] || ''}>
                            {sourceLabels[log.source] || log.source}
                          </Badge>
                          <Badge variant="secondary" className="text-xs font-mono">{log.error_type}</Badge>
                          {guide && (
                            <Badge variant="outline" className={`text-[10px] ${severityColors[guide.severity]}`}>
                              {severityLabels[guide.severity]}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(log.created_at).toLocaleString('pl-PL')}
                          </span>
                        </div>

                        <p className="text-foreground">{log.message}</p>

                        {log.user_id && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Użytkownik: <span className="font-mono">{log.user_id.slice(0, 8)}...</span>
                          </p>
                        )}

                        {guide && (
                          <div className="mt-2 p-2 rounded-md bg-muted/50 border border-border">
                            <p className="text-xs font-semibold flex items-center gap-1">
                              <Wrench className="w-3 h-3" /> {guide.title}
                            </p>
                            <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                              {guide.fixes.slice(0, 2).map((fix, index) => <li key={index}>{fix}</li>)}
                            </ul>
                            <details className="mt-1">
                              <summary className="text-[10px] text-primary cursor-pointer hover:underline">Wszystkie kroki -&gt;</summary>
                              <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                                {guide.fixes.map((fix, index) => <li key={index}>{fix}</li>)}
                              </ul>
                            </details>
                          </div>
                        )}

                        {log.details && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Szczegóły JSON</summary>
                            <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  })}

                  {filteredLogs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {search
                        ? 'Brak wyników wyszukiwania'
                        : `Brak błędów do pokazania. Aktualnie ta lista zbiera logi z: ${LOGGED_SOURCE_KEYS.map((source) => sourceLabels[source] || source).join(', ')}.`}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'guides' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> Poradnik rozwiązywania problemów
            </CardTitle>
            <CardDescription>
              {Object.keys(TROUBLESHOOT_GUIDES).length} kategorii. Pokrywa AI, płatności, auth, storage, e-maile, KSeF i typowe problemy po migracji na VPS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {Object.entries(TROUBLESHOOT_GUIDES)
                .sort(([, a], [, b]) => severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title, 'pl'))
                .map(([key, guide]) => (
                  <AccordionItem key={key} value={key}>
                    <AccordionTrigger className="text-sm hover:no-underline">
                      <div className="flex items-center gap-2 text-left">
                        <Badge variant="outline" className={`text-[10px] ${severityColors[guide.severity]}`}>
                          {severityLabels[guide.severity]}
                        </Badge>
                        <span>{guide.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="font-semibold text-xs text-muted-foreground mb-1">Objawy:</p>
                          <div className="flex flex-wrap gap-1">
                            {guide.symptoms.map((symptom, index) => (
                              <Badge key={index} variant="outline" className="text-xs font-mono">{symptom}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-muted-foreground mb-1">Przyczyny:</p>
                          <ul className="list-disc list-inside text-xs space-y-0.5 text-muted-foreground">
                            {guide.causes.map((cause, index) => <li key={index}>{cause}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-muted-foreground mb-1">Jak naprawić:</p>
                          <div className="bg-muted/50 rounded-md p-3 space-y-1">
                            {guide.fixes.map((fix, index) => <p key={index} className="text-xs">{fix}</p>)}
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-muted-foreground mb-1">Powiązane pliki:</p>
                          <div className="bg-muted/50 rounded-md p-3 space-y-1">
                            {guide.files.map((file, index) => <p key={index} className="text-xs font-mono text-muted-foreground">{file}</p>)}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {activeTab === 'checklist' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" /> Checklist po migracji na VPS
            </CardTitle>
            <CardDescription>Lista kontrolna pod nową domenę, nowy serwer i nowy sposób wysyłki.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {VPS_CHECKLIST.map((item, index) => (
                <div key={index} className="flex gap-3 p-3 rounded-lg border bg-card">
                  <span className="text-xs font-semibold text-primary min-w-[42px]">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{item.desc}</p>
                    <details className="mt-1.5">
                      <summary className="text-[10px] text-primary cursor-pointer hover:underline">Powiązane pliki ({item.files.length})</summary>
                      <div className="mt-1 space-y-0.5">
                        {item.files.map((file, fileIndex) => (
                          <p key={fileIndex} className="text-[11px] font-mono text-muted-foreground">{file}</p>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-primary" /> Szybkie komendy diagnostyczne (VPS)
              </h3>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre">
{`# Status usług
docker compose ps

# Logi aplikacji
docker compose logs -f --tail=100

# Zużycie dysku
df -h

# Zużycie RAM
free -h

# Połączenia DB
docker compose exec db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Test SSL
curl -vI https://twojadomena.pl

# Test webhooka mailowego
curl -X POST https://twojadomena.pl/api/email/send -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{"from":"test@example.com","to":["test@example.com"],"subject":"test","html":"ok"}'

# Restart
docker compose restart`}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
