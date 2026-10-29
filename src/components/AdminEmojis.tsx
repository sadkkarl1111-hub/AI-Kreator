import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, Smile, FolderPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { vpsFetch } from '@/lib/vpsApi';
import { splitEmojiInput } from '@/lib/emojiCatalog';

type EmojiCategory = {
  id: string;
  label: string;
  sort_order: number;
  emojis: { id: string; emoji: string; sort_order: number }[];
};

type AdminEmojisResponse = {
  ok?: boolean;
  error?: string;
  categories?: EmojiCategory[];
  count?: number;
};

const DEFAULT_CATEGORY_LABELS = [
  '✅ Checkmarki & statusy',
  '👋 Gesty & dłonie',
  '😀 Buźki',
  '🎯 Symbole & znaki',
  '💼 Biznes & praca',
  '🎨 Kreatywność',
  '🌍 Natura & pogoda',
  '🍕 Jedzenie',
  '🚀 Technologia',
  '❤️ Serca & miłość',
  '🔢 Cyfry & litery',
  '⚠️ Ostrzeżenia',
];

export function AdminEmojis() {
  const [categories, setCategories] = useState<EmojiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [newCatDialog, setNewCatDialog] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [addEmojiDialog, setAddEmojiDialog] = useState<string | null>(null);
  const [newEmojis, setNewEmojis] = useState('');

  const fetchCategories = useCallback(async () => {
    try {
      const data = await vpsFetch<AdminEmojisResponse>('/admin/emojis/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list' }),
      });
      if (data?.error) throw new Error(data.error);
      setCategories(data.categories || []);
    } catch (error: any) {
      toast.error(error?.message || 'Nie udało się pobrać emoji');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleAddCategory = async () => {
    if (!newCatLabel.trim()) return;
    const data = await vpsFetch<AdminEmojisResponse>('/admin/emojis/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'add_category', label: newCatLabel.trim() }),
    });
    const error = data?.error ? new Error(data.error) : null;
    if (error) { toast.error('Błąd dodawania kategorii'); return; }
    toast.success('Kategoria dodana');
    setNewCatDialog(false);
    setNewCatLabel('');
    fetchCategories();
  };

  const seedDefaultCategories = async () => {
    const data = await vpsFetch<AdminEmojisResponse>('/admin/emojis/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'seed_default_categories', labels: DEFAULT_CATEGORY_LABELS }),
    });
    const error = data?.error ? new Error(data.error) : null;
    if (error) {
      toast.error('Nie udało się załadować domyślnych kategorii');
      return;
    }

    toast.success('Załadowano domyślne kategorie emoji');
    fetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    const data = await vpsFetch<AdminEmojisResponse>('/admin/emojis/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete_category', categoryId: id }),
    });
    const error = data?.error ? new Error(data.error) : null;
    if (error) { toast.error('Błąd usuwania'); return; }
    toast.success('Kategoria usunięta');
    fetchCategories();
  };

  const handleAddEmojis = async () => {
    if (!addEmojiDialog || !newEmojis.trim()) return;
    const parsed = splitEmojiInput(newEmojis);
    
    if (parsed.length === 0) return;

    const data = await vpsFetch<AdminEmojisResponse>('/admin/emojis/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'add_emojis', categoryId: addEmojiDialog, emojis: parsed }),
    });
    const error = data?.error ? new Error(data.error) : null;
    if (error) { toast.error('Błąd dodawania emoji'); return; }
    toast.success(`Dodano ${parsed.length} emoji`);
    setAddEmojiDialog(null);
    setNewEmojis('');
    fetchCategories();
  };

  const handleDeleteEmoji = async (emojiId: string) => {
    await vpsFetch<AdminEmojisResponse>('/admin/emojis/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete_emoji', emojiId }),
    });
    fetchCategories();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Smile className="w-5 h-5" /> Elementy biblioteki
            </span>
            <Button size="sm" className="gap-1" onClick={() => setNewCatDialog(true)}>
              <FolderPlus className="w-4 h-4" /> Nowa kategoria
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Ładowanie...</p>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">Brak kategorii emoji. Możesz dodać własną albo załadować domyślne.</p>
              <Button size="sm" variant="outline" className="gap-1" onClick={seedDefaultCategories}>
                <FolderPlus className="w-4 h-4" /> Załaduj domyślne kategorie
              </Button>
            </div>
          ) : (
            categories.map(cat => (
              <div key={cat.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{cat.label}</h3>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setAddEmojiDialog(cat.id)}>
                      <Plus className="w-3 h-3" /> Dodaj emoji
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cat.emojis.map(e => (
                    <div key={e.id} className="group relative">
                      <span className="w-10 h-10 flex items-center justify-center text-xl rounded-md bg-accent/50">{e.emoji}</span>
                      <button
                        onClick={() => handleDeleteEmoji(e.id)}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {cat.emojis.length === 0 && (
                    <p className="text-xs text-muted-foreground">Brak emoji w tej kategorii</p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* New category dialog */}
      <Dialog open={newCatDialog} onOpenChange={setNewCatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowa kategoria emoji</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nazwa kategorii (np. 🎉 Impreza)"
            value={newCatLabel}
            onChange={e => setNewCatLabel(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCatDialog(false)}>Anuluj</Button>
            <Button onClick={handleAddCategory} disabled={!newCatLabel.trim()}>Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add emojis dialog */}
      <Dialog
        open={!!addEmojiDialog}
        onOpenChange={(open) => {
          if (!open) {
            setAddEmojiDialog(null);
            setNewEmojis('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj emoji do kategorii</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Wklej emoji obok siebie lub oddzielone spacjami. Złożone emoji, odcienie skóry i flagi pozostaną jednym elementem.</p>
          <Input
            placeholder="🎉🎊🥳🎈"
            value={newEmojis}
            onChange={e => setNewEmojis(e.target.value)}
            className="text-2xl"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEmojiDialog(null)}>Anuluj</Button>
            <Button onClick={handleAddEmojis} disabled={!newEmojis.trim()}>Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
