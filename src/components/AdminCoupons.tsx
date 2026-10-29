import { useEffect, useState } from 'react';
import { vpsFetch } from '@/lib/vpsApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Ban, Copy, Plus, RefreshCw, Tag, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type PromoCode = {
  id: string;
  code: string;
  active: boolean;
  times_redeemed: number;
  max_redemptions: number | null;
};

type Coupon = {
  id: string;
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  valid: boolean;
  times_redeemed: number;
  created: number;
  promotion_codes: PromoCode[];
};

const callAdminCouponsAction = <T,>(body: Record<string, unknown>) =>
  vpsFetch<T>('/admin/coupons/actions', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [addCouponDialog, setAddCouponDialog] = useState(false);
  const [addPromoDialog, setAddPromoDialog] = useState<string | null>(null);
  const [newCoupon, setNewCoupon] = useState({ name: '', isPercent: true, value: '' });
  const [newPromoCode, setNewPromoCode] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const data = await callAdminCouponsAction<{ coupons: Coupon[] }>({ action: 'list' });
      setCoupons(data.coupons || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się pobrać kuponów'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active=true; queueMicrotask(()=>{if(active)void fetchCoupons();});
    return()=>{active=false;};
  }, []);

  const handleCreateCoupon = async () => {
    const val = parseFloat(newCoupon.value);
    if (!newCoupon.name || Number.isNaN(val) || val <= 0) {
      toast.error('Wypełnij poprawnie wszystkie pola');
      return;
    }
    if (newCoupon.isPercent && val > 20) {
      toast.error('Maksymalny rabat wynosi 20%');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        action: 'create_coupon',
        name: newCoupon.name,
      };

      if (newCoupon.isPercent) {
        body.percentOff = val;
      } else {
        body.amountOff = Math.round(val * 100); // PLN to grosze
      }

      await callAdminCouponsAction<{ coupon: Coupon }>(body);
      toast.success('Kupon utworzony');
      setAddCouponDialog(false);
      setNewCoupon({ name: '', isPercent: true, value: '' });
      fetchCoupons();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się utworzyć kuponu'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePromoCode = async () => {
    if (!newPromoCode.trim() || !addPromoDialog) {
      toast.error('Wpisz kod');
      return;
    }

    setSaving(true);
    try {
      await callAdminCouponsAction<{ promo: PromoCode }>({
        action: 'create_promo_code',
        couponId: addPromoDialog,
        code: newPromoCode.trim(),
      });
      toast.success(`Kod "${newPromoCode.toUpperCase()}" utworzony`);
      setAddPromoDialog(null);
      setNewPromoCode('');
      fetchCoupons();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się utworzyć kodu'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivatePromo = async (promoId: string) => {
    try {
      await callAdminCouponsAction<{ success: boolean }>({ action: 'deactivate_promo', promoId });
      toast.success('Kod dezaktywowany');
      fetchCoupons();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się dezaktywować kodu'));
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten kupon?')) return;

    try {
      await callAdminCouponsAction<{ success: boolean }>({ action: 'delete_coupon', couponId });
      toast.success('Kupon usunięty');
      fetchCoupons();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się usunąć kuponu'));
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Skopiowano: ${code}`);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" /> Kody rabatowe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" /> Kody rabatowe
              <Badge variant="secondary">{coupons.length}</Badge>
            </CardTitle>
            <CardDescription>Zarządzaj kuponami i kodami promocyjnymi (lokalnie)</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchCoupons}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setAddCouponDialog(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Nowy kupon
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {coupons.map((coupon) => (
              <div key={coupon.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{coupon.name || coupon.id}</span>
                    <Badge variant={coupon.valid ? 'default' : 'secondary'}>
                      {coupon.percent_off
                        ? `${coupon.percent_off}%`
                        : `${((coupon.amount_off || 0) / 100).toFixed(0)} zł`}
                    </Badge>
                    {!coupon.valid && <Badge variant="destructive">Nieaktywny</Badge>}
                    <span className="text-xs text-muted-foreground">
                      Użyto: {coupon.times_redeemed}x · {new Date(coupon.created * 1000).toLocaleDateString('pl-PL')}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => {
                        setAddPromoDialog(coupon.id);
                        setNewPromoCode('');
                      }}
                    >
                      <Plus className="h-3 w-3" /> Dodaj kod
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDeleteCoupon(coupon.id)}
                    >
                      <Trash2 className="h-3 w-3" /> Usuń
                    </Button>
                  </div>
                </div>

                {coupon.promotion_codes.length > 0 && (
                  <div className="ml-4 space-y-1.5 border-l-2 border-border pl-3">
                    {coupon.promotion_codes.map((pc) => (
                      <div key={pc.id} className="flex items-center gap-2 text-sm">
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{pc.code}</code>
                        <Badge variant={pc.active ? 'default' : 'secondary'} className="text-xs">
                          {pc.active ? 'Aktywny' : 'Nieaktywny'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Użyto: {pc.times_redeemed}x
                          {pc.max_redemptions && ` / ${pc.max_redemptions}`}
                        </span>
                        <div className="ml-auto flex gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyCode(pc.code)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          {pc.active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeactivatePromo(pc.id)}
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {coupon.promotion_codes.length === 0 && (
                  <p className="ml-4 text-xs text-muted-foreground">
                    Brak kodów promocyjnych - dodaj kod, który użytkownicy będą wpisywać przy zakupie.
                  </p>
                )}
              </div>
            ))}
            {coupons.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Brak kuponów</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={addCouponDialog} onOpenChange={() => setAddCouponDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowy kupon rabatowy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nazwa kuponu</Label>
              <Input
                placeholder="np. Letnia promocja"
                value={newCoupon.name}
                onChange={(e) => setNewCoupon({ ...newCoupon, name: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={newCoupon.isPercent}
                onCheckedChange={(v) => setNewCoupon({ ...newCoupon, isPercent: v, value: '' })}
              />
              <Label>{newCoupon.isPercent ? 'Rabat procentowy (%)' : 'Rabat kwotowy (PLN)'}</Label>
            </div>
            <div>
              <Label>{newCoupon.isPercent ? 'Procent rabatu' : 'Kwota rabatu (PLN)'}</Label>
              <Input
                type="number"
                placeholder={newCoupon.isPercent ? 'np. 20' : 'np. 10'}
                value={newCoupon.value}
                onChange={(e) => setNewCoupon({ ...newCoupon, value: e.target.value })}
                min={1}
                max={newCoupon.isPercent ? 20 : undefined}
              />
              <p className="mt-1 text-xs text-muted-foreground">Maksymalny rabat to 20% ceny pakietu. Limit dotyczy także kuponów kwotowych.</p>
              {!newCoupon.isPercent && newCoupon.value && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Rabat: {parseFloat(newCoupon.value).toFixed(2)} zł od ceny pakietu
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCouponDialog(false)}>
              Anuluj
            </Button>
            <Button onClick={handleCreateCoupon} disabled={saving}>
              {saving ? 'Tworzę...' : 'Utwórz kupon'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addPromoDialog} onOpenChange={() => setAddPromoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj kod promocyjny</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kod (zostanie zamieniony na wielkie litery)</Label>
              <Input
                placeholder="np. LATO2026"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.replace(/\s/g, ''))}
                className="font-mono uppercase"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Ten kod użytkownicy będą wpisywać w polu "Kod kuponu" na stronie kredytów.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPromoDialog(null)}>
              Anuluj
            </Button>
            <Button onClick={handleCreatePromoCode} disabled={saving || !newPromoCode.trim()}>
              {saving ? 'Tworzę...' : 'Dodaj kod'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
