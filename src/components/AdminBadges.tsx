import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { vpsFetch } from '@/lib/vpsApi';
import { Plus, Trash2, Award, Eye, EyeOff, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { BADGE_CATALOG } from '@/lib/badgeCatalog';
import { newestBadgesFirst } from '@/lib/badgeLibraryView';

const STATIC_BADGES = newestBadgesFirst(BADGE_CATALOG).map(({ id, name, category, src }) => ({ id, name, category, src }));

type DbBadge = {
  id: string;
  name: string;
  description: string;
  category: string;
  storage_path: string;
  public_url?: string;
  sort_order: number;
};

type CreditPackage = {
  id: string;
  label: string;
  credits: number;
  active: boolean;
};

type BadgeAccess = {
  id: string;
  badge_key: string;
  package_id: string;
};

const CATEGORIES = [...new Set([...BADGE_CATALOG.map(badge => badge.category), 'Inne'])];

type AdminBadgesResponse = {
  ok?: boolean;
  badges?: DbBadge[];
  hiddenKeys?: string[];
  packages?: CreditPackage[];
  access?: BadgeAccess[];
  error?: string;
};

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export function AdminBadges() {
  const [badges, setBadges] = useState<DbBadge[]>([]);
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [badgeAccess, setBadgeAccess] = useState<BadgeAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialog, setAddDialog] = useState(false);
  const [accessDialog, setAccessDialog] = useState<{ badgeKey: string; badgeName: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('Inne');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vpsFetch<AdminBadgesResponse>('/admin/badges/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list' }),
      });

      setBadges(data.badges || []);
      setHiddenKeys(data.hiddenKeys || []);
      setPackages(data.packages || []);
      setBadgeAccess(data.access || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się pobrać badge');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the server settings when this admin panel mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newFile) return;
    setUploading(true);

    const fileBase64 = await fileToBase64(newFile);

    const uploadErr = await vpsFetch('/admin/badges/actions', {
      method: 'POST',
      body: JSON.stringify({
        action: 'add',
        badge: {
          name: newName.trim(),
          description: newDesc.trim(),
          category: newCategory,
          fileName: newFile.name,
          fileType: newFile.type,
          fileBase64,
        },
      }),
    }).then(() => null).catch((requestError) => requestError);

    if (uploadErr) {
      toast.error('Błąd przesyłania pliku');
      setUploading(false);
      return;
    }

    const error = uploadErr;

    if (error) {
      toast.error('Błąd dodawania badge');
      setUploading(false);
      return;
    }

    toast.success('Badge dodany!');
    setAddDialog(false);
    resetForm();
    fetchData();
  };

  const handleDeleteDbBadge = async (badge: DbBadge) => {
    const error = await vpsFetch('/admin/badges/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', badgeId: badge.id }),
    }).then(() => null).catch((requestError) => requestError);
    if (error) { toast.error('Błąd usuwania'); return; }
    toast.success('Badge usunięty');
    fetchData();
  };

  const handleHideStaticBadge = async (badgeKey: string) => {
    const error = await vpsFetch('/admin/badges/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'hide_static', badgeKey }),
    }).then(() => null).catch((requestError) => requestError);
    if (error) { toast.error('Błąd ukrywania badge'); return; }
    toast.success('Badge ukryty');
    fetchData();
  };

  const handleShowStaticBadge = async (badgeKey: string) => {
    const error = await vpsFetch('/admin/badges/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'show_static', badgeKey }),
    }).then(() => null).catch((requestError) => requestError);
    if (error) { toast.error('Błąd przywracania badge'); return; }
    toast.success('Badge przywrócony');
    fetchData();
  };

  const getAccessPackages = (badgeKey: string) => {
    return badgeAccess.filter(a => a.badge_key === badgeKey);
  };

  const togglePackageAccess = async (badgeKey: string, packageId: string) => {
    try {
      await vpsFetch('/admin/badges/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'toggle_access', badgeKey, packageId }),
      });
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać dostępu');
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewDesc('');
    setNewCategory('Inne');
    setNewFile(null);
    setPreview(null);
    setUploading(false);
  };

  const renderPackageBadges = (badgeKey: string) => {
    const assigned = getAccessPackages(badgeKey);
    if (assigned.length === 0) {
      return <span className="text-[10px] text-green-600 dark:text-green-400">Dla wszystkich</span>;
    }
    return (
      <div className="flex flex-wrap gap-1 justify-center">
        {assigned.map(a => {
          const pkg = packages.find(p => p.id === a.package_id);
          return pkg ? (
            <Badge key={a.id} variant="secondary" className="text-[9px] px-1 py-0">{pkg.label}</Badge>
          ) : null;
        })}
      </div>
    );
  };

  return (
    <>
      <Card className="min-w-0">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex flex-col items-start gap-3 text-xl sm:flex-row sm:items-center sm:justify-between sm:text-2xl">
            <span className="flex min-w-0 items-center gap-2">
              <Award className="w-5 h-5 shrink-0" /> Zarządzanie badge'ami
            </span>
            <Button size="sm" className="h-11 w-full gap-1 sm:w-auto shrink-0" onClick={() => setAddDialog(true)}>
              <Plus className="w-4 h-4" /> Nowy badge
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Ładowanie...</p>
          ) : (
            <>
              {/* Static badges section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Wbudowane badge'e</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {STATIC_BADGES.map((badge, index) => {
                    const isHidden = hiddenKeys.includes(badge.id);
                    return (
                      <div key={badge.id} className="relative min-w-0 border rounded-lg p-2 sm:p-3 flex flex-col items-center gap-2">
                        <div className={`w-full aspect-square flex items-center justify-center p-2 rounded-md bg-muted/50 ${isHidden ? 'opacity-40' : ''}`}>
                          <img
                            src={badge.src}
                            alt={badge.name}
                            loading={index < 4 ? 'eager' : 'lazy'}
                            decoding="async"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <p className="w-full break-words text-xs font-medium text-center">{badge.name}</p>
                        <span className="text-[10px] text-muted-foreground">{badge.category}</span>
                        {isHidden && <Badge variant="secondary" className="text-[10px]">Ukryty</Badge>}
                        {renderPackageBadges(badge.id)}
                        <div className="mt-auto grid grid-cols-1 gap-2 w-full">
                          {isHidden ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-11 w-full min-w-0 gap-1 px-2 text-xs"
                              onClick={() => handleShowStaticBadge(badge.id)}
                            >
                              <Eye className="w-3 h-3" /> Przywróć
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-11 w-full min-w-0 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleHideStaticBadge(badge.id)}
                            >
                              <EyeOff className="w-3 h-3" /> Ukryj
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-11 w-full min-w-0 gap-1 px-2 text-xs"
                            aria-label={`Pakiety dostępu: ${badge.name}`}
                            onClick={() => setAccessDialog({ badgeKey: badge.id, badgeName: badge.name })}
                          >
                            <Package className="w-3 h-3" /> Pakiety
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DB badges section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Dodane badge'e</h3>
                {badges.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Brak dodanych badge'ów</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {badges.map((badge, index) => (
                      <div key={badge.id} className="relative min-w-0 border rounded-lg p-2 sm:p-3 flex flex-col items-center gap-2">
                        <div className="w-full aspect-square flex items-center justify-center p-2 rounded-md bg-muted/50">
                          <img
                            src={badge.public_url || badge.storage_path}
                            alt={badge.name}
                            loading={index < 4 ? 'eager' : 'lazy'}
                            decoding="async"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <p className="w-full break-words text-xs font-medium text-center">{badge.name}</p>
                        <span className="text-[10px] text-muted-foreground">{badge.category}</span>
                        {renderPackageBadges(badge.id)}
                        <div className="mt-auto grid grid-cols-1 gap-2 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-11 w-full min-w-0 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDeleteDbBadge(badge)}
                          >
                            <Trash2 className="w-3 h-3" /> Usuń
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-11 w-full min-w-0 gap-1 px-2 text-xs"
                            aria-label={`Pakiety dostępu: ${badge.name}`}
                            onClick={() => setAccessDialog({ badgeKey: badge.id, badgeName: badge.name })}
                          >
                            <Package className="w-3 h-3" /> Pakiety
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add badge dialog */}
      <Dialog open={addDialog} onOpenChange={(o) => { setAddDialog(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowy badge</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nazwa badge'a" value={newName} onChange={e => setNewName(e.target.value)} />
            <Input placeholder="Opis (opcjonalny)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <label className="text-sm font-medium">Plik PNG (najlepiej z przezroczystym tłem)</label>
              <Input type="file" accept="image/png,image/webp,image/svg+xml" onChange={handleFileChange} />
              {preview && (
                <div className="w-24 h-24 mx-auto flex items-center justify-center rounded-md bg-accent/30 p-2">
                  <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Anuluj</Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || !newFile || uploading}>
              {uploading ? 'Przesyłanie...' : 'Dodaj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Package access dialog */}
      <Dialog open={!!accessDialog} onOpenChange={(o) => { if (!o) setAccessDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" /> Dostęp do badge'a: {accessDialog?.badgeName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Zaznacz pakiety, których zakup odblokuje ten badge. Brak zaznaczenia = dostępny dla wszystkich.
            </p>
            {packages.filter(p => p.active).map(pkg => {
              const isChecked = badgeAccess.some(
                a => a.badge_key === accessDialog?.badgeKey && a.package_id === pkg.id
              );
              return (
                <label key={pkg.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => accessDialog && togglePackageAccess(accessDialog.badgeKey, pkg.id)}
                  />
                  <span className="text-sm font-medium">{pkg.label}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{pkg.credits} kredytów</span>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessDialog(null)}>Zamknij</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
