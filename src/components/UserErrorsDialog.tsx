import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';
import { sourceColors, sourceLabels } from './adminErrorLogConfig';
import { vpsFetch } from '@/lib/vpsApi';

type ErrorLog = {
  id: string;
  error_type: string;
  source: string;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type UserErrorsResponse = {
  ok?: boolean;
  error?: string;
  logs?: ErrorLog[];
};

interface UserErrorsDialogProps {
  userId: string | null;
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserErrorsDialog({ userId, email, open, onOpenChange }: UserErrorsDialogProps) {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;

    setLoading(true);
    vpsFetch<UserErrorsResponse>('/admin/error-logs/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'list_user', userId }),
    })
      .then((data) => setLogs(data.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Błędy użytkownika: {email}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {loading && [1, 2, 3].map((index) => <Skeleton key={index} className="h-16 w-full" />)}

          {!loading && logs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Brak błędów dla tego użytkownika.
            </p>
          )}

          {!loading && logs.map((log) => (
            <div key={log.id} className="space-y-1 rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={sourceColors[log.source] || 'bg-muted text-muted-foreground'}>
                  {sourceLabels[log.source] || log.source}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{log.error_type}</Badge>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {new Date(log.created_at).toLocaleString('pl-PL')}
                </span>
              </div>

              <p className="text-sm text-foreground">{log.message}</p>

              {log.details && (
                <pre className="max-h-24 overflow-x-auto rounded bg-muted/50 p-2 text-[10px] text-muted-foreground">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
