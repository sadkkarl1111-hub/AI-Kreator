import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Bot, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { vpsFetch } from '@/lib/vpsApi';

type AiModel = {
  id: string;
  name: string;
  model_id: string;
  provider: string;
  api_model: string | null;
  credit_cost: number;
  active: boolean;
  sort_order: number;
  supports_generation: boolean;
  supports_editing: boolean;
  supports_reference_images: boolean;
  created_at: string;
};

type ModelForm = {
  name: string;
  model_id: string;
  provider: string;
  api_model: string;
  credit_cost: number;
  active: boolean;
  sort_order: number;
  supports_generation: boolean;
  supports_editing: boolean;
  supports_reference_images: boolean;
};

type AdminModelsResponse = {
  ok?: boolean;
  error?: string;
  models?: AiModel[];
  model?: AiModel;
};

const emptyForm: ModelForm = {
  name: '',
  model_id: '',
  provider: 'custom',
  api_model: '',
  credit_cost: 50,
  active: false,
  sort_order: 0,
  supports_generation: true,
  supports_editing: true,
  supports_reference_images: false,
};

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function AdminModels() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ModelForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<AiModel | null>(null);

  const fetchModels = async () => {
    try {
      const data = await vpsFetch<AdminModelsResponse>('/admin/models/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list' }),
      });
      setModels(data.models || []);
    } catch {
      toast.error('Nie udalo sie pobrac modeli');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: models.length });
    setDialogOpen(true);
  };

  const openEdit = (model: AiModel) => {
    setEditingId(model.id);
    setForm({
      name: model.name,
      model_id: model.model_id,
      provider: model.provider,
      api_model: model.api_model || model.model_id,
      credit_cost: model.credit_cost,
      active: model.active,
      sort_order: model.sort_order,
      supports_generation: model.supports_generation,
      supports_editing: model.supports_editing,
      supports_reference_images: model.supports_reference_images,
    });
    setDialogOpen(true);
  };

  const modelPayload = () => ({
    name: form.name.trim(),
    model_id: normalizeIdentifier(form.model_id),
    provider: normalizeIdentifier(form.provider),
    api_model: form.api_model.trim(),
    credit_cost: form.credit_cost,
    active: form.active,
    sort_order: form.sort_order,
    supports_generation: form.supports_generation,
    supports_editing: form.supports_editing,
    supports_reference_images: form.supports_reference_images,
  });

  const handleSave = async () => {
    const payload = modelPayload();
    if (!payload.name || !payload.model_id || !payload.api_model) {
      toast.error('Nazwa, ID wewnetrzne i kod API sa wymagane');
      return;
    }

    setSaving(true);
    try {
      await vpsFetch<AdminModelsResponse>('/admin/models/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: editingId ? 'update' : 'create',
          modelId: editingId || undefined,
          model: payload,
        }),
      });
      toast.success(editingId ? 'Model zaktualizowany' : 'Model dodany');
      setDialogOpen(false);
      fetchModels();
    } catch (error: any) {
      toast.error(error.message || 'Blad zapisu');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await vpsFetch<AdminModelsResponse>('/admin/models/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', modelId: deleteDialog.id }),
      });
      toast.success('Model usuniety');
      fetchModels();
    } catch {
      toast.error('Nie udalo sie usunac');
    }
    setDeleteDialog(null);
  };

  const toggleActive = async (model: AiModel) => {
    try {
      await vpsFetch<AdminModelsResponse>('/admin/models/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          modelId: model.id,
          model: { active: !model.active },
        }),
      });
      fetchModels();
    } catch {
      toast.error('Blad zmiany statusu');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" /> Modele AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" /> Modele AI
              <Badge variant="secondary" className="ml-2">{models.length}</Badge>
            </CardTitle>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="w-4 h-4" /> Dodaj model
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {models.map((model) => {
              const apiCode = (model.api_model || model.model_id).trim();
              const showApiCode = apiCode.toLowerCase() !== model.model_id.trim().toLowerCase();

              return (
                <div
                  key={model.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{model.name}</span>
                      <Badge variant="outline" className="text-xs">ID: {model.model_id}</Badge>
                      <Badge variant="outline" className="text-xs">Provider: {model.provider}</Badge>
                      {showApiCode && <Badge variant="outline" className="text-xs">Kod API: {apiCode}</Badge>}
                      {model.supports_generation && <Badge variant="secondary" className="text-xs">Generuje</Badge>}
                      {model.supports_editing && <Badge variant="secondary" className="text-xs">Edytuje</Badge>}
                      {model.supports_reference_images && <Badge variant="secondary" className="text-xs">Referencje</Badge>}
                      {model.active ? (
                        <Badge className="text-xs bg-primary/20 text-primary">Aktywny</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Nieaktywny</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>Koszt: <span className="font-medium text-foreground">{model.credit_cost} kr</span></span>
                      <span>Kolejnosc: {model.sort_order}</span>
                      <span>Klucz API: <span className="text-muted-foreground">zabezpieczony</span></span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Switch checked={model.active} onCheckedChange={() => toggleActive(model)} />
                    <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => openEdit(model)}>
                      <Pencil className="w-3 h-3" /> Edytuj
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog(model)}
                    >
                      <Trash2 className="w-3 h-3" /> Usun
                    </Button>
                  </div>
                </div>
              );
            })}
            {models.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Brak modeli. Dodaj pierwszy model AI.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={() => setDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edytuj model' : 'Dodaj nowy model AI'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nazwa wyświetlana</Label>
                <Input
                  placeholder="np. Wisdom Pro"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div>
                <Label>ID wewnętrzne (unikalne)</Label>
                <Input
                  placeholder="np. canvas-pro"
                  value={form.model_id}
                  onChange={(event) => setForm({ ...form, model_id: event.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provider</Label>
                <Input
                  placeholder="np. google albo openai"
                  value={form.provider}
                  onChange={(event) => setForm({ ...form, provider: event.target.value })}
                />
              </div>
              <div>
                <Label>Koszt (kredyty)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.credit_cost}
                  onChange={(event) => setForm({ ...form, credit_cost: parseInt(event.target.value, 10) || 1 })}
                />
              </div>
            </div>
            <div>
              <Label>Techniczny kod modelu API</Label>
              <Input
                placeholder="np. gpt-image-2 albo gemini-3-pro-image"
                value={form.api_model}
                onChange={(event) => setForm({ ...form, api_model: event.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Nazwę widoczną dla użytkownika zmieniaj w polu „Nazwa wyświetlana”. Kod API zmieniaj tylko wtedy, gdy zmieniasz prawdziwy model u providera.
            </p>
            <p className="text-xs text-muted-foreground">
              Klucze API są przechowywane bezpiecznie na serwerze i nie są dostępne z poziomu panelu.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kolejność sortowania</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => setForm({ ...form, sort_order: parseInt(event.target.value, 10) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.active} onCheckedChange={(checked) => setForm({ ...form, active: checked })} />
                <Label>Aktywny</Label>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.supports_generation}
                  onCheckedChange={(checked) => setForm({ ...form, supports_generation: checked })}
                />
                <Label>Generowanie</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.supports_editing}
                  onCheckedChange={(checked) => setForm({ ...form, supports_editing: checked })}
                />
                <Label>Edycja</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.supports_reference_images}
                  onCheckedChange={(checked) => setForm({ ...form, supports_reference_images: checked })}
                />
                <Label>Referencje</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="w-4 h-4 mr-1" /> Anuluj
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" /> {editingId ? 'Zapisz' : 'Dodaj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usun model</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Czy na pewno chcesz usunac model <span className="font-medium text-foreground">{deleteDialog?.name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Anuluj</Button>
            <Button variant="destructive" onClick={handleDelete}>Usun</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
