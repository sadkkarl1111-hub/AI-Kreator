import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Shield, ShieldOff, KeyRound, Mail, Coins, Users, Search, Trash2, AlertTriangle, Download, CheckSquare } from 'lucide-react';
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
import { UserErrorsDialog } from '@/components/UserErrorsDialog';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { ADMIN_TABS, ADMIN_TAB_LABELS } from '@/lib/adminTabs';
import { exportToCsv } from '@/lib/csvExport';
import { vpsFetch } from '@/lib/vpsApi';

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  credits: number;
  roles: string[];
  panel_role: string | null;
};

type PanelRoleConfig = {
  role_key: string;
  label: string;
  tabs: string[];
};

type AdminUsersActionResponse = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  users?: AdminUser[];
  roles?: PanelRoleConfig[];
};

const hasUnlimitedCredits = (user: Pick<AdminUser, 'roles'>) => user.roles.includes('admin');

const formatUserCredits = (user: Pick<AdminUser, 'credits' | 'roles'>) => (
  hasUnlimitedCredits(user) ? 'Nielimitowane' : user.credits.toLocaleString('pl-PL')
);

export function AdminPanel() {
  const { isSuperAdmin } = useAdminAccess();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleConfig, setRoleConfig] = useState<PanelRoleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [passwordDialog, setPasswordDialog] = useState<{ userId: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [creditsDialog, setCreditsDialog] = useState<{ userId: string; email: string } | null>(null);
  const [creditsAmount, setCreditsAmount] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ userId: string; email: string } | null>(null);
  const [errorsDialog, setErrorsDialog] = useState<{ userId: string; email: string } | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCreditsDialog, setBulkCreditsDialog] = useState(false);
  const [bulkCreditsAmount, setBulkCreditsAmount] = useState('');

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const callAdminUsersAction = async (body: Record<string, unknown>) => (
    vpsFetch<AdminUsersActionResponse>('/admin/users/actions', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );

  const fetchUsers = async () => {
    try {
      const data = await callAdminUsersAction({ action: 'list_users' });
      setUsers(data.users || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się pobrać użytkowników');
    }
  };

  const fetchRoleConfig = async () => {
    try {
      const data = await callAdminUsersAction({ action: 'list_role_access' });
      setRoleConfig(data.roles || []);
    } catch {
      setRoleConfig([]);
    }
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchRoleConfig()]).finally(() => setLoading(false));
  }, []);

  const handleAction = async (action: string, userId?: string, extra: Record<string, unknown> = {}) => {
    const loadingKey = `${action}-${userId || 'global'}`;
    setActionLoading(loadingKey);
    try {
      const body: Record<string, unknown> = { action, ...extra };
      if (userId) body.userId = userId;
      const data = await callAdminUsersAction(body);

      toast.success(data.message || 'Sukces');
      await Promise.all([fetchUsers(), fetchRoleConfig()]);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Błąd podczas wykonywania operacji');
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordDialog || !newPassword) return;
    const success = await handleAction('update_password', passwordDialog.userId, { password: newPassword });
    if (!success) return;
    setPasswordDialog(null);
    setNewPassword('');
  };

  const handleCreditsSubmit = async (mode: 'add' | 'remove') => {
    if (!creditsDialog || !creditsAmount) return;
    const num = parseInt(creditsAmount, 10);
    if (isNaN(num) || num <= 0) { toast.error('Podaj prawidłową liczbę'); return; }
    await handleAction(mode === 'remove' ? 'remove_credits' : 'add_credits', creditsDialog.userId, { credits: num });
    setCreditsDialog(null);
    setCreditsAmount('');
  };

  const handleBulkCredits = async (mode: 'add' | 'remove') => {
    const num = parseInt(bulkCreditsAmount, 10);
    if (isNaN(num) || num <= 0) { toast.error('Podaj prawidłową liczbę'); return; }
    const action = mode === 'remove' ? 'remove_credits' : 'add_credits';
    let success = 0;
    for (const userId of selectedIds) {
      try {
        await callAdminUsersAction({ action, userId, credits: num });
        success++;
      } catch {}
    }
    toast.success(`Zaktualizowano kredyty dla ${success}/${selectedIds.size} użytkowników`);
    setBulkCreditsDialog(false);
    setBulkCreditsAmount('');
    setSelectedIds(new Set());
    fetchUsers();
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog) return;
    await handleAction('delete_user', deleteDialog.userId);
    setDeleteDialog(null);
  };

  const handleSendResetLink = async (user: Pick<AdminUser, 'id' | 'email'>) => {
    if (!user.email) {
      toast.error('Ten użytkownik nie ma adresu email');
      return;
    }

    await handleAction('send_reset', user.id);
  };

  const handlePanelRoleChange = async (userId: string, roleKey: string) => {
    await handleAction('set_panel_role', userId, { roleKey: roleKey === 'none' ? null : roleKey });
  };

  const toggleRoleTab = async (roleKey: string, tabKey: string, enabled: boolean) => {
    await handleAction('toggle_role_tab', undefined, { roleKey, tabKey, enabled });
  };

  const roleLabel = (roleKey: string | null) => {
    if (!roleKey) return null;
    return roleConfig.find((r) => r.role_key === roleKey)?.label || roleKey;
  };

  const handleExportUsers = () => {
    exportToCsv('uzytkownicy.csv', filteredUsers.map(u => ({
      email: u.email,
      kredyty: formatUserCredits(u),
      rejestracja: new Date(u.created_at).toLocaleDateString('pl-PL'),
      ostatnie_logowanie: u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('pl-PL') : '',
      role: u.roles.join(', '),
      rola_panelu: u.panel_role || '',
    })), [
      { key: 'email', label: 'Email' },
      { key: 'kredyty', label: 'Kredyty' },
      { key: 'rejestracja', label: 'Rejestracja' },
      { key: 'ostatnie_logowanie', label: 'Ostatnie logowanie' },
      { key: 'role', label: 'Role' },
      { key: 'rola_panelu', label: 'Rola panelu' },
    ]);
    toast.success('Eksportowano użytkowników');
  };

  const filteredUsers = users.filter((u) => u.email?.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Panel administratora</CardTitle>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Users className="w-5 h-5" /> Panel administratora
            <Badge variant="secondary" className="ml-2">{users.length} użytkowników</Badge>
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Szukaj po emailu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleExportUsers}>
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setBulkCreditsDialog(true)}>
                  <Coins className="w-3.5 h-3.5" /> Kredyty ({selectedIds.size})
                </Button>
              )}
            </div>
          </div>
          {filteredUsers.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground">
                {selectedIds.size > 0 ? `Zaznaczono ${selectedIds.size}` : 'Zaznacz wszystkich'}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card">
                <div className="min-w-0 flex-1 flex items-start gap-2">
                  <Checkbox
                    checked={selectedIds.has(user.id)}
                    onCheckedChange={() => toggleSelect(user.id)}
                    className="mt-1 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isSuperAdmin && user.email ? (
                        <Link
                          to={`/gallery?${new URLSearchParams({ userId: user.id, email: user.email }).toString()}`}
                          className="font-medium text-sm text-primary hover:underline underline-offset-4 break-all"
                        >
                          {user.email}
                        </Link>
                      ) : (
                        <span className="font-medium text-sm truncate">{user.email}</span>
                      )}
                      {user.roles.includes('admin') && <Badge variant="default" className="text-xs">Admin</Badge>}
                      {user.panel_role && <Badge variant="outline" className="text-xs">{roleLabel(user.panel_role)}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span>Kredyty: <span className="font-medium text-foreground">{formatUserCredits(user)}</span></span>
                      <span>Rejestracja: {new Date(user.created_at).toLocaleDateString('pl-PL')}</span>
                      {user.last_sign_in_at && (
                        <span>Ostatnie logowanie: {new Date(user.last_sign_in_at).toLocaleDateString('pl-PL')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 items-center">
                  {isSuperAdmin && (
                    <Select value={user.panel_role || 'none'} onValueChange={(value) => handlePanelRoleChange(user.id, value)}>
                      <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Rola panelu" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">Brak roli panelu</SelectItem>
                        {roleConfig.map((role) => (
                          <SelectItem key={role.role_key} value={role.role_key} className="text-xs">{role.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {isSuperAdmin && (
                    <Button variant="outline" size="sm" className="text-xs gap-1" disabled={actionLoading === `toggle_admin-${user.id}`} onClick={() => handleAction('toggle_admin', user.id)}>
                      {user.roles.includes('admin') ? <><ShieldOff className="w-3 h-3" /> Usuń admina</> : <><Shield className="w-3 h-3" /> Nadaj admina</>}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setCreditsDialog({ userId: user.id, email: user.email || '' })}>
                    <Coins className="w-3 h-3" /> Kredyty
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setPasswordDialog({ userId: user.id, email: user.email || '' })}>
                    <KeyRound className="w-3 h-3" /> Hasło
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1" disabled={actionLoading === `send_reset-${user.id}`} onClick={() => handleSendResetLink(user)}>
                    <Mail className="w-3 h-3" /> Reset link
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setErrorsDialog({ userId: user.id, email: user.email || '' })}>
                    <AlertTriangle className="w-3 h-3" /> Błędy
                  </Button>
                  {isSuperAdmin && (
                    <Button variant="outline" size="sm" className="text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ userId: user.id, email: user.email || '' })}>
                      <Trash2 className="w-3 h-3" /> Usuń
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Brak użytkowników</p>
            )}
          </div>
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Role panelu i dostęp do zakładek</CardTitle>
            <p className="text-sm text-muted-foreground">Przypisz, do których zakładek panelu admina ma dostęp rola.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {roleConfig.map((role) => (
              <div key={role.role_key} className="border rounded-lg p-3 space-y-3">
                <p className="text-sm font-medium">{role.label}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ADMIN_TABS.map((tab) => {
                    const checked = role.tabs.includes(tab);
                    const lockAdministrator = role.role_key === 'administrator';
                    return (
                      <div key={`${role.role_key}-${tab}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-xs">{ADMIN_TAB_LABELS[tab]}</span>
                        <Switch
                          checked={lockAdministrator ? true : checked}
                          disabled={lockAdministrator || actionLoading === 'toggle_role_tab-global'}
                          onCheckedChange={(enabled) => toggleRoleTab(role.role_key, tab, enabled)}
                        />
                      </div>
                    );
                  })}
                </div>
                {role.role_key === 'administrator' && (
                  <p className="text-xs text-muted-foreground">Rola Administrator ma zawsze pełny dostęp.</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!passwordDialog} onOpenChange={() => { setPasswordDialog(null); setNewPassword(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Zmień hasło: {passwordDialog?.email}</DialogTitle></DialogHeader>
          <Input type="password" placeholder="Nowe hasło (min. 6 znaków)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialog(null)}>Anuluj</Button>
            <Button onClick={handlePasswordSubmit} disabled={newPassword.length < 6}>Zmień hasło</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditsDialog} onOpenChange={() => { setCreditsDialog(null); setCreditsAmount(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Zarządzaj kredytami: {creditsDialog?.email}</DialogTitle></DialogHeader>
          <Input type="number" placeholder="Liczba kredytów" value={creditsAmount} onChange={(e) => setCreditsAmount(e.target.value)} min={1} max={100000} />
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setCreditsDialog(null)}>Anuluj</Button>
            <Button variant="destructive" onClick={() => handleCreditsSubmit('remove')} disabled={!creditsAmount || parseInt(creditsAmount, 10) <= 0}>Zabierz</Button>
            <Button onClick={() => handleCreditsSubmit('add')} disabled={!creditsAmount || parseInt(creditsAmount, 10) <= 0}>Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkCreditsDialog} onOpenChange={() => { setBulkCreditsDialog(false); setBulkCreditsAmount(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Masowa zmiana kredytów ({selectedIds.size} użytkowników)</DialogTitle></DialogHeader>
          <Input type="number" placeholder="Liczba kredytów" value={bulkCreditsAmount} onChange={(e) => setBulkCreditsAmount(e.target.value)} min={1} max={100000} />
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkCreditsDialog(false)}>Anuluj</Button>
            <Button variant="destructive" onClick={() => handleBulkCredits('remove')} disabled={!bulkCreditsAmount || parseInt(bulkCreditsAmount, 10) <= 0}>Zabierz</Button>
            <Button onClick={() => handleBulkCredits('add')} disabled={!bulkCreditsAmount || parseInt(bulkCreditsAmount, 10) <= 0}>Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserErrorsDialog userId={errorsDialog?.userId || null} email={errorsDialog?.email || ''} open={!!errorsDialog} onOpenChange={() => setErrorsDialog(null)} />

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Usuń użytkownika</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Czy na pewno chcesz usunąć <span className="font-medium text-foreground">{deleteDialog?.email}</span>? Ta operacja jest nieodwracalna.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Anuluj</Button>
            <Button variant="destructive" onClick={handleDeleteUser}>Usuń użytkownika</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
