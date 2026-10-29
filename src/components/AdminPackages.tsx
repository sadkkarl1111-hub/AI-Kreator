import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Package, Save, Plus, Trash2, GripVertical } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { vpsFetch } from '@/lib/vpsApi';

type CreditPackage = {
  id: string;
  label: string;
  credits: number;
  price_grosze: number;
  popular: boolean;
  active: boolean;
  sort_order: number;
};

type AdminPackagesResponse = {
  ok?: boolean;
  error?: string;
  packages?: CreditPackage[];
  package?: CreditPackage;
  success?: boolean;
};

export function AdminPackages() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editPkg, setEditPkg] = useState<CreditPackage | null>(null);
  const [addDialog, setAddDialog] = useState(false);
  const [newPkg, setNewPkg] = useState({ id: '', label: '', credits: 0, price_grosze: 0 });
  const [deleteDialog, setDeleteDialog] = useState<CreditPackage | null>(null);

  const fetchPackages = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await vpsFetch<AdminPackagesResponse>('/admin/packages/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list' }),
      });

      if (data?.error) {
        setLoadError(data.error);
        setPackages([]);
        toast.error(`Nie udało się pobrać pakietów: ${data.error}`);
      } else {
        setPackages(data.packages || []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się pobrać pakietów';
      setLoadError(message);
      setPackages([]);
      toast.error(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleSave = async (pkg: CreditPackage) => {
    setSaving(pkg.id);
    try {
      const data = await vpsFetch<AdminPackagesResponse>('/admin/packages/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          packageId: pkg.id,
          package: {
            label: pkg.label,
            credits: pkg.credits,
            price_grosze: pkg.price_grosze,
            popular: pkg.popular,
            active: pkg.active,
            sort_order: pkg.sort_order,
          },
        }),
      });
      const error = data?.error ? new Error(data.error) : null;

      if (error) {
        toast.error('Nie udało się zapisać zmian');
        console.error(error);
      } else {
        toast.success(`Pakiet "${pkg.label}" zaktualizowany`);
        fetchPackages();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać zmian');
      console.error(error);
    } finally {
      setSaving(null);
      setEditPkg(null);
    }
  };

  const handleAdd = async () => {
    if (!newPkg.id || !newPkg.label || newPkg.credits <= 0 || newPkg.price_grosze <= 0) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }
    try {
      const data = await vpsFetch<AdminPackagesResponse>('/admin/packages/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          package: {
            id: newPkg.id,
            label: newPkg.label,
            credits: newPkg.credits,
            price_grosze: newPkg.price_grosze,
            sort_order: packages.length + 1,
          },
        }),
      });
      const error = data?.error ? new Error(data.error) : null;
      if (error) {
        toast.error('Nie udało się dodać pakietu');
        console.error(error);
      } else {
        toast.success('Pakiet dodany');
        setAddDialog(false);
        setNewPkg({ id: '', label: '', credits: 0, price_grosze: 0 });
        fetchPackages();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się dodać pakietu');
      console.error(error);
    }
  };

  const handleDelete = async (pkg: CreditPackage) => {
    try {
      const data = await vpsFetch<AdminPackagesResponse>('/admin/packages/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', packageId: pkg.id }),
      });
      const error = data?.error ? new Error(data.error) : null;
      if (error) {
        toast.error('Nie udało się usunąć pakietu');
      } else {
        toast.success(`Pakiet "${pkg.label}" usunięty`);
        fetchPackages();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się usunąć pakietu');
      console.error(error);
    } finally {
      setDeleteDialog(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> Pakiety kredytów</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" /> Pakiety kredytów
          </CardTitle>
          <Button size="sm" onClick={() => setAddDialog(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Dodaj pakiet
          </Button>
        </CardHeader>
        <CardContent>
          {loadError && (
            <div className="mb-3 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <p className="text-destructive">Nie udało się pobrać pakietów: {loadError}</p>
              <div>
                <Button variant="outline" size="sm" onClick={fetchPackages}>
                  Spróbuj ponownie
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border ${pkg.active ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60'}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{pkg.label}</span>
                      {pkg.popular && (
                        <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Popularne</span>
                      )}
                      {!pkg.active && (
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Nieaktywny</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {pkg.credits.toLocaleString('pl-PL')} kredytów · {(pkg.price_grosze / 100).toFixed(0)} zł · ID: {pkg.id}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setEditPkg({ ...pkg })}>
                    <Save className="w-3 h-3" /> Edytuj
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 text-destructive hover:text-destructive"
                    onClick={() => setDeleteDialog(pkg)}
                  >
                    <Trash2 className="w-3 h-3" /> Usuń
                  </Button>
                </div>
              </div>
            ))}
            {packages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Brak pakietów</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editPkg} onOpenChange={() => setEditPkg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj pakiet: {editPkg?.label}</DialogTitle>
          </DialogHeader>
          {editPkg && (
            <div className="space-y-4">
              <div>
                <Label>Nazwa</Label>
                <Input value={editPkg.label} onChange={(e) => setEditPkg({ ...editPkg, label: e.target.value })} />
              </div>
              <div>
                <Label>Kredyty</Label>
                <Input type="number" value={editPkg.credits} onChange={(e) => setEditPkg({ ...editPkg, credits: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <div>
                <Label>Cena (grosze, np. 2500 = 25 zł)</Label>
                <Input type="number" value={editPkg.price_grosze} onChange={(e) => setEditPkg({ ...editPkg, price_grosze: parseInt(e.target.value, 10) || 0 })} />
                <p className="text-xs text-muted-foreground mt-1">= {(editPkg.price_grosze / 100).toFixed(2)} zł</p>
              </div>
              <div>
                <Label>Kolejność sortowania</Label>
                <Input type="number" value={editPkg.sort_order} onChange={(e) => setEditPkg({ ...editPkg, sort_order: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editPkg.popular} onCheckedChange={(v) => setEditPkg({ ...editPkg, popular: v })} />
                <Label>Oznacz jako popularne</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editPkg.active} onCheckedChange={(v) => setEditPkg({ ...editPkg, active: v })} />
                <Label>Aktywny</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPkg(null)}>Anuluj</Button>
            <Button onClick={() => editPkg && handleSave(editPkg)} disabled={saving !== null}>
              {saving ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialog} onOpenChange={() => setAddDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj nowy pakiet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ID (unikalne, np. pack_50)</Label>
              <Input value={newPkg.id} onChange={(e) => setNewPkg({ ...newPkg, id: e.target.value })} />
            </div>
            <div>
              <Label>Nazwa</Label>
              <Input value={newPkg.label} onChange={(e) => setNewPkg({ ...newPkg, label: e.target.value })} />
            </div>
            <div>
              <Label>Kredyty</Label>
              <Input type="number" value={newPkg.credits || ''} onChange={(e) => setNewPkg({ ...newPkg, credits: parseInt(e.target.value, 10) || 0 })} />
            </div>
            <div>
              <Label>Cena (grosze, np. 5000 = 50 zł)</Label>
              <Input type="number" value={newPkg.price_grosze || ''} onChange={(e) => setNewPkg({ ...newPkg, price_grosze: parseInt(e.target.value, 10) || 0 })} />
              {newPkg.price_grosze > 0 && (
                <p className="text-xs text-muted-foreground mt-1">= {(newPkg.price_grosze / 100).toFixed(2)} zł</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Anuluj</Button>
            <Button onClick={handleAdd}>Dodaj pakiet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuń pakiet</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Czy na pewno chcesz usunąć pakiet <span className="font-medium text-foreground">{deleteDialog?.label}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Anuluj</Button>
            <Button variant="destructive" onClick={() => deleteDialog && handleDelete(deleteDialog)}>Usuń</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
