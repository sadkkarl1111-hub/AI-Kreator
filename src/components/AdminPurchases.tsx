import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Receipt, Download, FileText, Settings, Save, Loader2, Pencil, Mail, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCsv } from '@/lib/csvExport';
import { vpsFetch } from '@/lib/vpsApi';

type Purchase = {
  id: string;
  user_id: string;
  credits: number;
  amount: number;
  paid_amount: number | null;
  status: string;
  created_at: string;
  stripe_session_id: string | null;
  billing_nip: string | null;
  billing_company: string | null;
  billing_address: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  user_email?: string;
};

type InvoiceSettings = {
  id: string;
  company_name: string;
  nip: string;
  address: string;
  postal_code: string;
  city: string;
  email: string;
};

type MlMapping = {
  package_id: string;
  group_id: string;
  group_name: string;
};

type MailerLiteConfigResponse = {
  mappings?: MlMapping[];
  packages?: Array<{ id: string; label: string; credits: number }>;
  error?: string;
};

type InvoiceResponse = {
  html?: string;
  error?: string;
};

type AdminPurchasesActionResponse = {
  purchases?: Purchase[];
  invoiceSettings?: InvoiceSettings | null;
  ksefEnabled?: boolean;
  purchase?: Purchase;
  success?: boolean;
  ksefNumber?: string;
  ksefAutoSent?: boolean;
  ksefAutoError?: string | null;
  elementReferenceNumber?: string;
  error?: string;
};

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export function AdminPurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [editForm, setEditForm] = useState({
    status: '',
    paid_amount: '',
    billing_company: '',
    billing_nip: '',
    billing_address: '',
    billing_postal_code: '',
    billing_city: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [mlPurchase, setMlPurchase] = useState<Purchase | null>(null);
  const [mlMappings, setMlMappings] = useState<MlMapping[]>([]);
  const [mlPackages, setMlPackages] = useState<{ id: string; label: string; credits: number }[]>([]);
  const [mlSelectedGroup, setMlSelectedGroup] = useState('');
  const [mlSending, setMlSending] = useState(false);
  const [ksefSendingId, setKsefSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ksefEnabled, setKsefEnabled] = useState(true);

  const loadMlData = async () => {
    try {
      const data = await vpsFetch<MailerLiteConfigResponse>('/admin/mailerlite/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'load_config', includeGroups: false }),
      });
      if (data.error) throw new Error(data.error);
      setMlMappings(data.mappings || []);
      setMlPackages((data.packages || []).map((p) => ({ id: p.id, label: p.label, credits: p.credits })));
    } catch (error) {
      toast.error(toErrorMessage(error, 'Nie udało się pobrać mapowania MailerLite'));
    }
  };

  const loadInvoiceSettings = async () => {
    try {
      const data = await vpsFetch<AdminPurchasesActionResponse>('/admin/purchases/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'load_settings' }),
      });
      if (data.error) throw new Error(data.error);
      if (data.invoiceSettings) setInvoiceSettings(data.invoiceSettings);
      setKsefEnabled(data.ksefEnabled ?? true);
    } catch (error) {
      toast.error(toErrorMessage(error, 'Nie udało się pobrać ustawień sprzedaży'));
    }
  };

  const loadPurchases = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await vpsFetch<AdminPurchasesActionResponse>('/admin/purchases/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list' }),
      });
      if (data.error) {
        setLoadError(data.error);
        setPurchases([]);
        toast.error(`Nie udało się pobrać zakupów: ${data.error}`);
      } else {
        setPurchases(data.purchases || []);
      }
    } catch (error) {
      const message = toErrorMessage(error, 'Nie udało się pobrać zakupów');
      setLoadError(message);
      setPurchases([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
    loadInvoiceSettings();
    loadMlData();
  }, []);

  const openMlDialog = (purchase: Purchase) => {
    setMlPurchase(purchase);
    const matchedPkg = mlPackages.find((pkg) => pkg.credits === purchase.credits);
    const mapping = matchedPkg ? mlMappings.find((m) => m.package_id === matchedPkg.id) : null;
    setMlSelectedGroup(mapping?.group_id || '');
  };

  const handleMlAssign = async () => {
    if (!mlPurchase || !mlSelectedGroup) return;
    setMlSending(true);
    try {
      const data = await vpsFetch<{ error?: string }>('/admin/mailerlite/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'add_subscriber', email: mlPurchase.user_email, groupId: mlSelectedGroup }),
      });
      if (data?.error) throw new Error(data.error);
      toast.success(`Dodano ${mlPurchase.user_email} do grupy MailerLite`);
      setMlPurchase(null);
    } catch (error) {
      toast.error(toErrorMessage(error, 'Nie udało się dodać subskrybenta'));
    } finally {
      setMlSending(false);
    }
  };

  const saveInvoiceSettings = async () => {
    if (!invoiceSettings) return;
    setSavingSettings(true);
    try {
      const data = await vpsFetch<AdminPurchasesActionResponse>('/admin/purchases/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'save_invoice_settings', invoiceSettings }),
      });
      if (data.error) throw new Error(data.error);
      if (data.invoiceSettings) setInvoiceSettings(data.invoiceSettings);
      toast.success('Dane sprzedawcy zaktualizowane');
    } catch (error) {
      toast.error(toErrorMessage(error, 'Nie udało się zapisać ustawień'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDownloadInvoice = async (purchase: Purchase) => {
    setDownloadingId(purchase.id);
    try {
      const data = await vpsFetch<InvoiceResponse>('/billing/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({ purchaseId: purchase.id }),
      });
      if (data?.error) throw new Error(data.error);

      const win = window.open('', '_blank');
      if (win && data.html) {
        win.document.write(data.html);
        win.document.close();
      }
    } catch (error) {
      toast.error(toErrorMessage(error, 'Nie udało się wygenerować faktury'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleKsefSend = async (purchase: Purchase) => {
    if (!ksefEnabled) {
      toast.error('KSeF jest wyłączony w ustawieniach administratora');
      return;
    }
    setKsefSendingId(purchase.id);
    try {
      const data = await vpsFetch<AdminPurchasesActionResponse>('/admin/purchases/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'send_ksef', purchaseId: purchase.id }),
      });
      if (!data?.success) {
        throw new Error(data?.error || 'Błąd wysyłki do KSeF');
      }
      toast.success(`Faktura wysłana do KSeF! Nr: ${data.ksefNumber || data.elementReferenceNumber || 'w trakcie'}`);
    } catch (error) {
      toast.error(`KSeF: ${toErrorMessage(error, 'Błąd wysyłki')}`);
    } finally {
      setKsefSendingId(null);
    }
  };

  const openEditDialog = (purchase: Purchase) => {
    setEditPurchase(purchase);
    setEditForm({
      status: purchase.status,
      paid_amount: purchase.paid_amount != null ? String(purchase.paid_amount / 100) : '',
      billing_company: purchase.billing_company || '',
      billing_nip: purchase.billing_nip || '',
      billing_address: purchase.billing_address || '',
      billing_postal_code: purchase.billing_postal_code || '',
      billing_city: purchase.billing_city || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editPurchase) return;
    setSavingEdit(true);

    const updateData: Record<string, unknown> = {
      status: editForm.status,
      billing_company: editForm.billing_company || null,
      billing_nip: editForm.billing_nip || null,
      billing_address: editForm.billing_address || null,
      billing_postal_code: editForm.billing_postal_code || null,
      billing_city: editForm.billing_city || null,
    };

    if (editForm.paid_amount.trim() !== '') {
      updateData.paid_amount = Math.round(parseFloat(editForm.paid_amount) * 100);
    } else {
      updateData.paid_amount = null;
    }

    try {
      const data = await vpsFetch<AdminPurchasesActionResponse>('/admin/purchases/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'update_purchase', purchaseId: editPurchase.id, purchase: updateData }),
      });
      if (data.error) throw new Error(data.error);
      if (data.ksefAutoSent) {
        toast.success(`Zakup zaktualizowany i wysłany do KSeF (${data.ksefNumber || 'w trakcie'})`);
      } else if (data.ksefAutoError) {
        toast.success('Zakup zaktualizowany');
        toast.error(`Auto KSeF: ${data.ksefAutoError}`);
      } else {
        toast.success('Zakup zaktualizowany');
      }
      setEditPurchase(null);
      loadPurchases();
    } catch (error) {
      toast.error(toErrorMessage(error, 'Nie udało się zaktualizować zakupu'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePurchase = async (purchase: Purchase) => {
    const confirmed = confirm(`Usunąć zakup użytkownika ${purchase.user_email} z dnia ${new Date(purchase.created_at).toLocaleString('pl-PL')}?`);
    if (!confirmed) return;

    setDeletingId(purchase.id);
    try {
      const data = await vpsFetch<AdminPurchasesActionResponse>('/admin/purchases/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_purchase', purchaseId: purchase.id }),
      });
      if (data.error) throw new Error(data.error);
      toast.success('Zakup został usunięty');
      await loadPurchases();
    } catch (error) {
      toast.error(toErrorMessage(error, 'Nie udało się usunąć zakupu'));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = purchases.filter(
    (purchase) =>
      purchase.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      purchase.billing_company?.toLowerCase().includes(search.toLowerCase()) ||
      purchase.billing_nip?.includes(search)
  );

  const statusLabel = (status: string) => {
    if (status === 'completed') return <Badge variant="default">Opłacone</Badge>;
    if (status === 'pending') return <Badge variant="secondary">Oczekujące</Badge>;
    return <Badge variant="destructive">Anulowane</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowSettings(!showSettings)}>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="w-4 h-4" /> Dane sprzedawcy na fakturze
            <Badge variant="outline" className="ml-auto">{showSettings ? 'Zwiń' : 'Rozwiń'}</Badge>
          </CardTitle>
        </CardHeader>
        {showSettings && invoiceSettings && (
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nazwa firmy</Label>
                <Input
                  value={invoiceSettings.company_name}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, company_name: e.target.value })}
                />
              </div>
              <div>
                <Label>NIP</Label>
                <Input
                  value={invoiceSettings.nip}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, nip: e.target.value })}
                />
              </div>
              <div>
                <Label>Adres</Label>
                <Input
                  value={invoiceSettings.address}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, address: e.target.value })}
                />
              </div>
              <div>
                <Label>Kod pocztowy</Label>
                <Input
                  value={invoiceSettings.postal_code}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, postal_code: e.target.value })}
                />
              </div>
              <div>
                <Label>Miasto</Label>
                <Input
                  value={invoiceSettings.city}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, city: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={invoiceSettings.email}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, email: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={saveInvoiceSettings} disabled={savingSettings} className="gap-1">
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Zapisz dane sprzedawcy
            </Button>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Receipt className="w-5 h-5" /> Zakupy
            <Badge variant="secondary" className="ml-2">{purchases.length} transakcji</Badge>
            <Badge variant={ksefEnabled ? 'outline' : 'destructive'}>
              {ksefEnabled ? 'KSeF włączony' : 'KSeF wyłączony'}
            </Badge>
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj po emailu, firmie lub NIP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0" onClick={() => {
              exportToCsv('zakupy.csv', filtered.map((purchase) => ({
                email: purchase.user_email,
                kredyty: purchase.credits,
                kwota_brutto: (purchase.amount / 100).toFixed(2),
                kwota_zaplacona: purchase.paid_amount != null ? (purchase.paid_amount / 100).toFixed(2) : '',
                status: purchase.status,
                firma: purchase.billing_company || '',
                nip: purchase.billing_nip || '',
                data: new Date(purchase.created_at).toLocaleDateString('pl-PL'),
              })), [
                { key: 'email', label: 'Email' },
                { key: 'kredyty', label: 'Kredyty' },
                { key: 'kwota_brutto', label: 'Kwota brutto (zł)' },
                { key: 'kwota_zaplacona', label: 'Zapłacono (zł)' },
                { key: 'status', label: 'Status' },
                { key: 'firma', label: 'Firma' },
                { key: 'nip', label: 'NIP' },
                { key: 'data', label: 'Data' },
              ]);
              toast.success('Eksportowano zakupy');
            }}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadError && (
            <div className="mb-3 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <p className="text-destructive">Nie udało się pobrać zakupów: {loadError}</p>
              <div>
                <Button variant="outline" size="sm" onClick={loadPurchases}>Spróbuj ponownie</Button>
              </div>
            </div>
          )}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filtered.map((purchase) => (
              <div
                key={purchase.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{purchase.user_email}</span>
                    {statusLabel(purchase.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span>+{purchase.credits.toLocaleString('pl-PL')} kredytów</span>
                    <span className="font-medium text-foreground">{(purchase.amount / 100).toFixed(2)} zł</span>
                    {purchase.paid_amount != null && purchase.paid_amount !== purchase.amount && (
                      <span className="text-green-600 font-medium">zapłacono: {(purchase.paid_amount / 100).toFixed(2)} zł</span>
                    )}
                    <span>{new Date(purchase.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {purchase.billing_company && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <FileText className="w-3 h-3" />
                      <span>{purchase.billing_company}</span>
                      {purchase.billing_nip && <span>NIP: {purchase.billing_nip}</span>}
                      {purchase.billing_city && <span>{purchase.billing_postal_code} {purchase.billing_city}</span>}
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => openEditDialog(purchase)}
                  >
                    <Pencil className="w-3 h-3" /> Edytuj
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1 text-destructive hover:text-destructive"
                    disabled={deletingId === purchase.id}
                    onClick={() => handleDeletePurchase(purchase)}
                  >
                    {deletingId === purchase.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Usuń
                  </Button>
                  {purchase.status === 'completed' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        disabled={downloadingId === purchase.id}
                        onClick={() => handleDownloadInvoice(purchase)}
                      >
                        <Download className="w-3 h-3" /> Faktura
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        onClick={() => openMlDialog(purchase)}
                      >
                        <Mail className="w-3 h-3" /> ML
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        disabled={!ksefEnabled || ksefSendingId === purchase.id}
                        onClick={() => handleKsefSend(purchase)}
                      >
                        <Send className="w-3 h-3" /> {ksefSendingId === purchase.id ? 'Wysyłam...' : 'KSeF'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Brak zakupów</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editPurchase} onOpenChange={() => setEditPurchase(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edytuj zakup</DialogTitle>
          </DialogHeader>
          {editPurchase && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{editPurchase.user_email}</span>
                {' · '}+{editPurchase.credits.toLocaleString('pl-PL')} kredytów
                {' · '}Cena pakietu: {(editPurchase.amount / 100).toFixed(2)} zł
              </div>

              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Opłacone</SelectItem>
                    <SelectItem value="pending">Oczekujące</SelectItem>
                    <SelectItem value="canceled">Anulowane</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Kwota zapłacona (zł)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`${(editPurchase.amount / 100).toFixed(2)} (cena pakietu)`}
                  value={editForm.paid_amount}
                  onChange={(e) => setEditForm({ ...editForm, paid_amount: e.target.value })}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Zostaw puste = cena pakietu. Wpisz rzeczywistą kwotę po rabacie.</p>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-sm font-medium mb-2">Dane nabywcy (faktura)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label>Firma</Label>
                    <Input
                      value={editForm.billing_company}
                      onChange={(e) => setEditForm({ ...editForm, billing_company: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>NIP</Label>
                    <Input
                      value={editForm.billing_nip}
                      onChange={(e) => setEditForm({ ...editForm, billing_nip: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Adres</Label>
                    <Input
                      value={editForm.billing_address}
                      onChange={(e) => setEditForm({ ...editForm, billing_address: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Kod pocztowy</Label>
                    <Input
                      value={editForm.billing_postal_code}
                      onChange={(e) => setEditForm({ ...editForm, billing_postal_code: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Miasto</Label>
                    <Input
                      value={editForm.billing_city}
                      onChange={(e) => setEditForm({ ...editForm, billing_city: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPurchase(null)}>Anuluj</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="gap-1">
              {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!mlPurchase} onOpenChange={() => setMlPurchase(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4" /> Dodaj do MailerLite
            </DialogTitle>
          </DialogHeader>
          {mlPurchase && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">{mlPurchase.user_email}</span>
                <span className="text-muted-foreground"> · +{mlPurchase.credits.toLocaleString('pl-PL')} kredytów</span>
              </div>
              <div>
                <Label>Grupa MailerLite</Label>
                <Select value={mlSelectedGroup} onValueChange={setMlSelectedGroup}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Wybierz grupę..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mlMappings.map((mapping) => (
                      <SelectItem key={mapping.group_id} value={mapping.group_id}>
                        {mapping.group_name} ({mlPackages.find((pkg) => pkg.id === mapping.package_id)?.label || mapping.package_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMlPurchase(null)}>Anuluj</Button>
            <Button onClick={handleMlAssign} disabled={mlSending || !mlSelectedGroup} className="gap-1">
              {mlSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Przypisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
