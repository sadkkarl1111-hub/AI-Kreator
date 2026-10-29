import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Mail, Plus, Pencil, Trash2, Eye, Code, Save, X, Copy,
  Bold, Italic, Link, Image, AlignCenter, List, Type,
} from 'lucide-react';
import { vpsFetch } from '@/lib/vpsApi';

type EmailTemplate = {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_content: string;
  variables: string[];
  active: boolean;
  updated_at: string;
};

type EmailTemplatesResponse = {
  ok?: boolean;
  error?: string;
  templates?: EmailTemplate[];
  template?: EmailTemplate;
};

export function AdminEmails() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [newTemplate, setNewTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchTemplates = async () => {
    let data: EmailTemplate[] = [];
    let error: Error | null = null;
    try {
      const result = await vpsFetch<EmailTemplatesResponse>('/admin/email-templates/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list' }),
      });
      if (result?.error) throw new Error(result.error);
      data = result.templates || [];
    } catch (err: any) {
      error = err;
    }

    if (error) {
      toast.error('Nie udało się pobrać szablonów');
      return;
    }
    setTemplates(data || []);
  };

  useEffect(() => {
    fetchTemplates().finally(() => setLoading(false));
  }, []);

  const openEditor = (template?: EmailTemplate) => {
    if (template) {
      setEditTemplate({ ...template });
      setNewTemplate(false);
    } else {
      setEditTemplate({
        id: '',
        slug: '',
        name: '',
        subject: '',
        html_content: getDefaultHtml(),
        variables: [],
        active: true,
        updated_at: '',
      });
      setNewTemplate(true);
    }
    setShowCode(false);
  };

  const handleSave = async () => {
    if (!editTemplate) return;
    if (!editTemplate.slug || !editTemplate.name || !editTemplate.subject) {
      toast.error('Wypełnij wszystkie wymagane pola (slug, nazwa, temat)');
      return;
    }

    setSaving(true);
    try {
      // Extract variables from HTML content
      const varMatches = editTemplate.html_content.match(/\{\{(\w+)\}\}/g) || [];
      const variables = [...new Set(varMatches)];

      if (newTemplate) {
        const data = await vpsFetch<EmailTemplatesResponse>('/admin/email-templates/actions', {
          method: 'POST',
          body: JSON.stringify({
            action: 'create',
            template: {
              slug: editTemplate.slug,
              name: editTemplate.name,
              subject: editTemplate.subject,
              html_content: editTemplate.html_content,
              variables,
              active: editTemplate.active,
            },
          }),
        });
        const error = data?.error ? new Error(data.error) : null;
        if (error) throw error;
        toast.success('Szablon utworzony!');
      } else {
        const data = await vpsFetch<EmailTemplatesResponse>('/admin/email-templates/actions', {
          method: 'POST',
          body: JSON.stringify({
            action: 'update',
            templateId: editTemplate.id,
            template: {
              name: editTemplate.name,
              subject: editTemplate.subject,
              html_content: editTemplate.html_content,
              variables,
              active: editTemplate.active,
            },
          }),
        });
        const error = data?.error ? new Error(data.error) : null;
        if (error) throw error;
        toast.success('Szablon zapisany!');
      }

      setEditTemplate(null);
      await fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Błąd podczas zapisywania');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    const data = await vpsFetch<EmailTemplatesResponse>('/admin/email-templates/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', templateId: deleteDialog.id }),
    });
    const error = data?.error ? new Error(data.error) : null;

    if (error) {
      toast.error('Nie udało się usunąć szablonu');
    } else {
      toast.success('Szablon usunięty');
      await fetchTemplates();
    }
    setDeleteDialog(null);
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    const data = await vpsFetch<EmailTemplatesResponse>('/admin/email-templates/actions', {
      method: 'POST',
      body: JSON.stringify({
        action: 'toggle',
        templateId: template.id,
        template: { active: !template.active },
      }),
    });
    const error = data?.error ? new Error(data.error) : null;

    if (error) {
      toast.error('Nie udało się zmienić statusu');
    } else {
      await fetchTemplates();
    }
  };

  const insertHtmlTag = (tag: string, attr?: string) => {
    if (!editTemplate) return;
    const textarea = document.querySelector('#html-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editTemplate.html_content.substring(start, end);
    const openTag = attr ? `<${tag} ${attr}>` : `<${tag}>`;
    const replacement = `${openTag}${selected}</${tag}>`;

    const newContent =
      editTemplate.html_content.substring(0, start) +
      replacement +
      editTemplate.html_content.substring(end);

    setEditTemplate({ ...editTemplate, html_content: newContent });
  };

  const insertVariable = (variable: string) => {
    if (!editTemplate) return;
    const textarea = document.querySelector('#html-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const pos = textarea.selectionStart;
    const newContent =
      editTemplate.html_content.substring(0, pos) +
      `{{${variable}}}` +
      editTemplate.html_content.substring(pos);

    setEditTemplate({ ...editTemplate, html_content: newContent });
  };

  const updatePreview = () => {
    if (!iframeRef.current || !editTemplate) return;
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(editTemplate.html_content);
      doc.close();
    }
  };

  useEffect(() => {
    if (editTemplate) {
      const timer = setTimeout(updatePreview, 300);
      return () => clearTimeout(timer);
    }
  }, [editTemplate?.html_content]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" /> Szablony e-mail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  // Editor view
  if (editTemplate) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {newTemplate ? 'Nowy szablon' : `Edycja: ${editTemplate.name}`}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditTemplate(null)}>
                <X className="w-4 h-4 mr-1" /> Anuluj
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> {saving ? 'Zapisywanie...' : 'Zapisz'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meta fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Slug (identyfikator)</label>
              <Input
                value={editTemplate.slug}
                onChange={(e) => setEditTemplate({ ...editTemplate, slug: e.target.value })}
                placeholder="np. welcome"
                disabled={!newTemplate}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nazwa</label>
              <Input
                value={editTemplate.name}
                onChange={(e) => setEditTemplate({ ...editTemplate, name: e.target.value })}
                placeholder="Email powitalny"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Temat wiadomości</label>
              <Input
                value={editTemplate.subject}
                onChange={(e) => setEditTemplate({ ...editTemplate, subject: e.target.value })}
                placeholder="Witaj w Kreatorze!"
              />
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 flex-wrap border rounded-lg p-2 bg-muted/30">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertHtmlTag('strong')}>
              <Bold className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertHtmlTag('em')}>
              <Italic className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertHtmlTag('h1')}>
              <Type className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertHtmlTag('a', 'href=""')}>
              <Link className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertHtmlTag('div', 'style="text-align:center"')}>
              <AlignCenter className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
              if (!editTemplate) return;
              const img = '<img src="" alt="" style="max-width:100%" />';
              const textarea = document.querySelector('#html-editor') as HTMLTextAreaElement;
              const pos = textarea?.selectionStart || 0;
              const newContent = editTemplate.html_content.substring(0, pos) + img + editTemplate.html_content.substring(pos);
              setEditTemplate({ ...editTemplate, html_content: newContent });
            }}>
              <Image className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            <Button
              variant={showCode ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setShowCode(!showCode)}
            >
              <Code className="w-4 h-4" /> {showCode ? 'Podgląd' : 'Kod HTML'}
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            <span className="text-xs text-muted-foreground mr-1">Zmienne:</span>
            {['email', 'resetLink', 'appBaseUrl', 'generatorUrl', 'resetPasswordUrl', 'credits', 'amount'].map((v) => (
              <Button
                key={v}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => insertVariable(v)}
              >
                {`{{${v}}}`}
              </Button>
            ))}
          </div>

          {/* Editor + Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: 500 }}>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {showCode ? 'Kod HTML' : 'Edytor HTML'}
              </label>
              <Textarea
                id="html-editor"
                value={editTemplate.html_content}
                onChange={(e) => setEditTemplate({ ...editTemplate, html_content: e.target.value })}
                className="font-mono text-xs h-[480px] resize-none"
                spellCheck={false}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Podgląd</label>
              <div className="border rounded-lg overflow-hidden bg-white" style={{ height: 480 }}>
                <iframe
                  ref={iframeRef}
                  title="Email preview"
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>

          {/* Variables info */}
          {editTemplate.variables.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Wykryte zmienne:</span>
              {editTemplate.variables.map((v) => (
                <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              checked={editTemplate.active}
              onCheckedChange={(checked) => setEditTemplate({ ...editTemplate, active: checked })}
            />
            <span className="text-sm">Aktywny</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // List view
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" /> Szablony e-mail
              <Badge variant="secondary" className="ml-2">{templates.length}</Badge>
            </CardTitle>
            <Button size="sm" className="gap-1" onClick={() => openEditor()}>
              <Plus className="w-4 h-4" /> Nowy szablon
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{tpl.name}</span>
                    <Badge variant="outline" className="text-xs font-mono">{tpl.slug}</Badge>
                    {!tpl.active && <Badge variant="destructive" className="text-xs">Nieaktywny</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Temat: {tpl.subject}
                  </p>
                  {tpl.variables.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {tpl.variables.map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Ostatnia zmiana: {new Date(tpl.updated_at).toLocaleString('pl-PL')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Switch
                    checked={tpl.active}
                    onCheckedChange={() => handleToggleActive(tpl)}
                  />
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setPreviewHtml(tpl.html_content)}>
                    <Eye className="w-3 h-3" /> Podgląd
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => openEditor(tpl)}>
                    <Pencil className="w-3 h-3" /> Edytuj
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 text-destructive hover:text-destructive"
                    onClick={() => setDeleteDialog(tpl)}
                  >
                    <Trash2 className="w-3 h-3" /> Usuń
                  </Button>
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Brak szablonów</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview dialog */}
      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Podgląd e-mail</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-white" style={{ height: 500 }}>
            <iframe
              title="Email preview"
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
              srcDoc={previewHtml || ''}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuń szablon</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Czy na pewno chcesz usunąć szablon <span className="font-medium text-foreground">{deleteDialog?.name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Anuluj</Button>
            <Button variant="destructive" onClick={handleDelete}>Usuń</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getDefaultHtml() {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Kreator Grafik AI</title>
<style>
  body{margin:0;padding:0;background:#1a1428;font-family:'Inter','Segoe UI',sans-serif;color:#e8e0f0}
  .wrap{max-width:560px;margin:0 auto;padding:40px 20px}
  .card{background:linear-gradient(145deg,#2a1f3d,#1e1530);border-radius:16px;padding:40px 32px;border:1px solid rgba(168,85,247,0.2)}
  .logo-row{text-align:center;margin-bottom:28px}
  .logo{display:inline-block;width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#a855f7,#ec4899,#3b82f6);line-height:56px;font-size:28px;text-align:center}
  .brand{font-family:'Space Grotesk','Segoe UI',sans-serif;font-size:22px;font-weight:700;background:linear-gradient(135deg,#a855f7,#ec4899,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-top:12px}
  h1{font-family:'Space Grotesk','Segoe UI',sans-serif;font-size:24px;font-weight:700;margin:0 0 16px;color:#f0e8ff}
  p{font-size:15px;line-height:1.7;color:#c4b5d6;margin:0 0 16px}
  .btn{display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff!important;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;margin:8px 0 24px}
  .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(168,85,247,0.3),transparent);margin:24px 0}
  .footer{text-align:center;font-size:12px;color:#7c6f8e;margin-top:24px}
  .highlight{color:#a855f7;font-weight:600}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="logo-row">
      <div class="logo">🎨</div>
      <div class="brand">Kreator Grafik AI</div>
    </div>
    <h1>Tytuł wiadomości</h1>
    <p>Treść wiadomości...</p>
    <div style="text-align:center">
      <a href="{{appBaseUrl}}" class="btn">Przejdź do aplikacji</a>
    </div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#7c6f8e">Stopka wiadomości</p>
  </div>
  <div class="footer">
    © ${new Date().getFullYear()} Kreator Grafik AI. Wszystkie prawa zastrzeżone.
  </div>
</div>
</body>
</html>`;
}
