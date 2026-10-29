import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock, Eye, FileText, Save } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { vpsFetch } from '@/lib/vpsApi';

type SiteContent = {
  id: string;
  slug: string;
  title: string;
  content: string;
  updated_at: string;
};

type AdminContentResponse = {
  ok?: boolean;
  error?: string;
  items?: SiteContent[];
};

const SLUG_LABELS: Record<string, string> = {
  terms: 'Regulamin',
  privacy: 'Polityka prywatności',
};

const SLUG_ROUTES: Record<string, string> = {
  terms: '/regulamin',
  privacy: '/polityka-prywatnosci',
};

export function AdminContent() {
  const [items, setItems] = useState<SiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { title: string; content: string }>>({});

  const fetchContent = async () => {
    setLoading(true);
    try {
      const data = await vpsFetch<AdminContentResponse>('/admin/content/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list' }),
      });
      const nextItems = data.items || [];
      setItems(nextItems);
      const nextDrafts: Record<string, { title: string; content: string }> = {};
      nextItems.forEach((item) => {
        nextDrafts[item.slug] = { title: item.title, content: item.content };
      });
      setDrafts(nextDrafts);
    } catch {
      toast.error('Nie udało się pobrać treści');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const handleSave = async (slug: string) => {
    const draft = drafts[slug];
    if (!draft) return;

    setSaving(slug);
    try {
      await vpsFetch<AdminContentResponse>('/admin/content/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          slug,
          title: draft.title,
          content: draft.content,
        }),
      });
      toast.success('Zapisano pomyślnie');
      fetchContent();
    } catch {
      toast.error('Nie udało się zapisać');
    }
    setSaving(null);
  };

  const updateDraft = (slug: string, field: 'title' | 'content', value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [slug]: { ...prev[slug], [field]: value },
    }));
  };

  const isDirty = (slug: string) => {
    const item = items.find((contentItem) => contentItem.slug === slug);
    const draft = drafts[slug];
    if (!item || !draft) return false;
    return item.title !== draft.title || item.content !== draft.content;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Treści stron</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((item) => <Skeleton key={item} className="h-32 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" /> Edycja treści stron
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Edytuj regulamin i politykę prywatności. Użyj zwykłego tekstu: linia zaczynająca się od <code className="bg-muted px-1 rounded">##</code> stanie się nagłówkiem sekcji, a linie zaczynające się od <code className="bg-muted px-1 rounded">-</code> utworzą listę punktowaną.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={items[0]?.slug || 'terms'}>
          <TabsList>
            {items.map((item) => (
              <TabsTrigger key={item.slug} value={item.slug} className="gap-1.5">
                {SLUG_LABELS[item.slug] || item.slug}
                {isDirty(item.slug) && <Badge variant="secondary" className="text-[10px] px-1">*</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>

          {items.map((item) => (
            <TabsContent key={item.slug} value={item.slug} className="space-y-4 mt-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Ostatnia edycja: {new Date(item.updated_at).toLocaleString('pl-PL')}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => window.open(SLUG_ROUTES[item.slug] || '/', '_blank')}
                  >
                    <Eye className="w-3 h-3" /> Podgląd
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1 text-xs"
                    disabled={!isDirty(item.slug) || saving === item.slug}
                    onClick={() => handleSave(item.slug)}
                  >
                    <Save className="w-3 h-3" />
                    {saving === item.slug ? 'Zapisywanie...' : 'Zapisz'}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Tytuł strony</label>
                <Input
                  value={drafts[item.slug]?.title || ''}
                  onChange={(event) => updateDraft(item.slug, 'title', event.target.value)}
                  placeholder="Tytuł..."
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Treść (markdown-like)</label>
                <Textarea
                  value={drafts[item.slug]?.content || ''}
                  onChange={(event) => updateDraft(item.slug, 'content', event.target.value)}
                  placeholder={`Wklej tutaj treść ${SLUG_LABELS[item.slug] || 'strony'}...\n\nUżyj ## dla nagłówków sekcji\nUżyj - dla list punktowanych`}
                  className="min-h-[400px] font-mono text-sm"
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
