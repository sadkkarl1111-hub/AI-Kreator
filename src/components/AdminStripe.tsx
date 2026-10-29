import { useEffect, useState } from 'react';
import { vpsFetch } from '@/lib/vpsApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, Clock, CreditCard, RefreshCw, Users, Wallet, XCircle } from 'lucide-react';

type BalanceItem = { amount: number; currency: string };
type Payment = {
  id: string;
  amount: number;
  paidAmount: number | null;
  currency: string;
  status: string;
  created: number;
  customerEmail: string | null;
  description: string | null;
};
type Customer = {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
};
type PaymentsDashboardData = {
  availableBalance: BalanceItem[];
  pendingBalance: BalanceItem[];
  payments: Payment[];
  customers: Customer[];
  providerLabel?: string;
};

const callAdminPaymentsAction = <T,>(body: Record<string, unknown>) =>
  vpsFetch<T>('/admin/payments/actions', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function statusBadge(status: string) {
  switch (status) {
    case 'succeeded':
      return (
        <Badge className="gap-1 bg-green-600 text-white">
          <CheckCircle className="h-3 w-3" /> Opłacone
        </Badge>
      );
    case 'canceled':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Anulowane
        </Badge>
      );
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'processing':
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> W trakcie
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function AdminPayments() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PaymentsDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await callAdminPaymentsAction<PaymentsDashboardData>({ action: 'dashboard' });
      setData(response);
    } catch (error) {
      setError(getErrorMessage(error, 'Nie udało się pobrać danych płatności'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await callAdminPaymentsAction<{ accountId: string }>({ action: 'test_connection' });
      toast.success(`Połączenie OK! Konto: ${response.accountId}`);
    } catch (error) {
      toast.error(`Połączenie z operatorem płatności nieudane: ${getErrorMessage(error, 'nieznany błąd')}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{error}</p>
          <div className="flex justify-center gap-2">
            <Button onClick={fetchData} variant="outline" className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Odśwież
            </Button>
            <Button onClick={testConnection} disabled={testing} className="gap-1.5">
              <CheckCircle className="h-4 w-4" /> Testuj połączenie
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CreditCard className="h-5 w-5" /> {data.providerLabel || 'Płatności online'}
        </h2>
        <div className="flex gap-2">
          <Button onClick={testConnection} variant="outline" size="sm" disabled={testing} className="gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> {testing ? 'Testowanie...' : 'Testuj połączenie'}
          </Button>
          <Button onClick={fetchData} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Odśwież
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" /> Dostępne środki
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.availableBalance.length === 0 ? (
              <p className="text-2xl font-bold">0,00 zł</p>
            ) : (
              data.availableBalance.map((balance, index) => (
                <p key={index} className="text-2xl font-bold">
                  {formatAmount(balance.amount, balance.currency)}
                </p>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> Oczekujące
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.pendingBalance.length === 0 ? (
              <p className="text-2xl font-bold">0,00 zł</p>
            ) : (
              data.pendingBalance.map((balance, index) => (
                <p key={index} className="text-2xl font-bold">
                  {formatAmount(balance.amount, balance.currency)}
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" /> Ostatnie płatności
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak płatności</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Data</th>
                    <th className="pb-2 pr-4">Klient</th>
                    <th className="pb-2 pr-4">Pakiet</th>
                    <th className="pb-2 pr-4">Zapłacono</th>
                    <th className="pb-2 pr-4">Opis</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((payment) => (
                    <tr key={payment.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap py-2 pr-4">
                        {new Date(payment.created * 1000).toLocaleDateString('pl-PL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="max-w-[200px] truncate py-2 pr-4">
                        {payment.customerEmail || '-'}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4 font-medium">
                        {formatAmount(payment.amount, payment.currency)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4">
                        {payment.paidAmount !== null && payment.paidAmount !== undefined ? (
                          <span className={payment.paidAmount < payment.amount ? 'font-medium text-green-600' : 'font-medium'}>
                            {formatAmount(payment.paidAmount, payment.currency)}
                            {payment.paidAmount < payment.amount && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                (-{Math.round((1 - payment.paidAmount / payment.amount) * 100)}%)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {payment.description || '-'}
                      </td>
                      <td className="py-2">{statusBadge(payment.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Ostatni klienci
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak klientów</p>
          ) : (
            <div className="grid gap-2">
              {data.customers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{customer.name || customer.email || 'Brak danych'}</p>
                    {customer.name && customer.email && (
                      <p className="text-xs text-muted-foreground">{customer.email}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(customer.created * 1000).toLocaleDateString('pl-PL')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const AdminStripe = AdminPayments;
