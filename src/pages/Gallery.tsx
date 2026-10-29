import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Download, Trash2, Image, Sparkles, Filter, Share2, Copy, Globe, AlertTriangle } from 'lucide-react';
import { EditTimeline } from '@/components/EditTimeline';
import { MAX_SAVED_GRAPHICS } from '@/lib/graphicsLimit';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { vpsFetch } from '@/lib/vpsApi';

type Graphic = {
  id: string;
  url: string | null;
  prompt: string;
  style: string;
  type: string;
  dimensions: string | null;
  created_at: string;
  public_token: string | null;
  is_public: boolean;
  signedUrl?: string | null;
  signed_url?: string | null;
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
  is_broken?: boolean;
};

type GalleryFilter = 'all' | 'generated' | 'template';

type GalleryResponse = {
  ok: boolean;
  graphics: Graphic[];
};

type GraphicResponse = {
  ok: boolean;
  graphic: Graphic;
};

type ShareResponse = {
  ok: boolean;
  public_token: string;
};

const getSignedUrl = (graphic: Graphic | null) => graphic?.signedUrl || graphic?.signed_url || null;
const getThumbnailUrl = (graphic: Graphic | null) => graphic?.thumbnailUrl || graphic?.thumbnail_url || getSignedUrl(graphic);

const Gallery = () => {
  const [searchParams] = useSearchParams();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [graphics, setGraphics] = useState<Graphic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [selected, setSelected] = useState<Graphic | null>(null);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [cleaningUp, setCleaningUp] = useState(false);

  const requestedUserId = searchParams.get('userId');
  const requestedEmail = searchParams.get('email');
  const isManagedGalleryView = isAdmin && !!requestedUserId;

  const loadGraphics = async () => {
    if (adminLoading) return;

    setLoading(true);

    try {
      const params = new URLSearchParams({
        filter,
        limit: '200',
      });

      if (requestedUserId && isAdmin) {
        params.set('userId', requestedUserId);
      }

      const data = await vpsFetch<GalleryResponse>(`/gallery?${params.toString()}`);
      const items = data.graphics || [];

      setGraphics(items);
      setBrokenIds(new Set(items.filter((graphic) => graphic.is_broken).map((graphic) => graphic.id)));
    } catch (error) {
      setGraphics([]);
      setBrokenIds(new Set());
      toast.error(error instanceof Error ? error.message : 'Nie udało się pobrać galerii');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminLoading) return;
    loadGraphics();
  }, [filter, adminLoading, isAdmin, requestedUserId]);

  const updateGraphicInState = (updated: Graphic) => {
    setSelected(updated);
    setGraphics((prev) => prev.map((graphic) => (graphic.id === updated.id ? updated : graphic)));
  };

  const handleDelete = async (id: string) => {
    if (isManagedGalleryView) {
      toast.error('W podglądzie administratora usuwanie grafik jest wyłączone');
      return;
    }

    try {
      await vpsFetch<{ ok: boolean }>(`/gallery/${id}`, { method: 'DELETE' });
      setGraphics((prev) => prev.filter((graphic) => graphic.id !== id));
      setBrokenIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSelected(null);
      toast.success('Usunięto');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się usunąć');
    }
  };

  const handleCleanupBroken = async () => {
    if (isManagedGalleryView || brokenIds.size === 0) return;

    setCleaningUp(true);
    const ids = Array.from(brokenIds);

    try {
      await vpsFetch<{ ok: boolean; deleted: number }>('/gallery/cleanup-broken', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
      setGraphics((prev) => prev.filter((graphic) => !brokenIds.has(graphic.id)));
      setBrokenIds(new Set());
      toast.success(`Usunięto ${ids.length} uszkodzonych grafik`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wyczyścić uszkodzonych grafik');
    } finally {
      setCleaningUp(false);
    }
  };

  const handleTogglePublic = async (graphic: Graphic, checked: boolean) => {
    try {
      const data = await vpsFetch<GraphicResponse>(`/gallery/${graphic.id}/public`, {
        method: 'PATCH',
        body: JSON.stringify({ is_public: checked }),
      });

      updateGraphicInState(data.graphic);
      toast.success(checked ? 'Grafika jest teraz publiczna' : 'Grafika jest teraz prywatna');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zmienić widoczności');
    }
  };

  const handleShare = async (graphic: Graphic) => {
    try {
      const data = await vpsFetch<ShareResponse>(`/gallery/${graphic.id}/share`, { method: 'POST' });
      const updated = { ...graphic, public_token: data.public_token };
      updateGraphicInState(updated);

      const url = `${window.location.origin}/shared/${data.public_token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link skopiowany do schowka!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się utworzyć linku');
    }
  };

  const handleDownload = async (graphic: Graphic) => {
    try {
      const downloadUrl = getSignedUrl(graphic);

      if (!downloadUrl) {
        toast.error('Nie udało się pobrać');
        return;
      }

      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `grafika-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Nie udało się pobrać');
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              <Sparkles className="inline w-6 h-6 text-primary mr-2" />
              {isManagedGalleryView ? 'Galeria' : 'Moja'} <span className="gradient-text">galeria</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              {isManagedGalleryView ? (
                <>
                  Podgląd użytkownika <span className="font-medium text-foreground">{requestedEmail || requestedUserId}</span> • {graphics.length} grafik
                </>
              ) : (
                `${graphics.length} grafik`
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {(['all', 'generated', 'template'] as const).map((value) => (
              <Button
                key={value}
                variant={filter === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(value)}
                className={filter === value ? 'gradient-bg' : ''}
              >
                {value === 'all' ? (
                  <>
                    <Filter className="w-3 h-3 mr-1" /> Wszystkie
                  </>
                ) : value === 'generated' ? 'Wygenerowane' : 'Szablony'}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-medium">Limit galerii: {MAX_SAVED_GRAPHICS} zapisanych grafik</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Po zapisaniu kolejnej pracy najstarsze pozycje są usuwane automatycznie.
            {filter === 'all' ? ` Aktualnie widzisz ${graphics.length}/${MAX_SAVED_GRAPHICS}.` : ''}
          </p>
        </div>

        {brokenIds.size > 0 && !loading && !isManagedGalleryView && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive flex-1">
              Wykryto <strong>{brokenIds.size}</strong> uszkodzonych grafik (pliki nie istnieją w storage).
            </p>
            <Button variant="destructive" size="sm" onClick={handleCleanupBroken} disabled={cleaningUp}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {cleaningUp ? 'Czyszczenie...' : 'Wyczyść niedziałające'}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : graphics.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Image className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Brak grafik</p>
              <p className="text-muted-foreground mt-1">
                {isManagedGalleryView ? 'Ten użytkownik nie ma jeszcze zapisanych grafik.' : 'Wygeneruj swoją pierwszą grafikę w generatorze AI'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {graphics.map((graphic, index) => {
              const previewUrl = getThumbnailUrl(graphic);

              return (
                <motion.div
                  key={graphic.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card
                    className={`overflow-hidden group cursor-pointer hover:shadow-lg transition-all ${brokenIds.has(graphic.id) ? 'ring-2 ring-destructive/50 opacity-60' : ''}`}
                    onClick={() => setSelected(graphic)}
                  >
                    <div className="aspect-square bg-muted relative">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={graphic.prompt}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                          width={360}
                          height={360}
                          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-1">
                          {brokenIds.has(graphic.id) ? (
                            <>
                              <AlertTriangle className="w-8 h-8 text-destructive" />
                              <span className="text-[10px] text-destructive">Uszkodzona</span>
                            </>
                          ) : (
                            <Image className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground truncate">{graphic.prompt}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(graphic.created_at).toLocaleDateString('pl-PL')}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
          <DialogContent className="max-w-2xl w-[min(95vw,42rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden">
            {selected && (
              <SelectedGraphicDialog
                graphic={selected}
                signedUrl={getSignedUrl(selected)}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onTogglePublic={handleTogglePublic}
                onShare={handleShare}
                allowEditing={!isManagedGalleryView}
                showTimeline={!isManagedGalleryView}
              />
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
};

function SelectedGraphicDialog({
  graphic,
  onDelete,
  onDownload,
  onTogglePublic,
  onShare,
  signedUrl,
  allowEditing,
  showTimeline,
}: {
  graphic: Graphic;
  onDelete: (id: string) => void;
  onDownload: (graphic: Graphic) => void;
  onTogglePublic: (graphic: Graphic, checked: boolean) => void;
  onShare: (graphic: Graphic) => void;
  signedUrl: string | null;
  allowEditing: boolean;
  showTimeline: boolean;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-sm font-normal text-muted-foreground flex items-start gap-2 max-w-full min-w-0">
          <span className="min-w-0 flex-1 break-words whitespace-normal line-clamp-2">{graphic.prompt}</span>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1 text-xs"
            onClick={() => {
              navigator.clipboard.writeText(graphic.prompt);
              toast.success('Prompt skopiowany!');
            }}
          >
            <Copy className="w-3 h-3" /> Kopiuj
          </Button>
        </DialogTitle>
      </DialogHeader>

      {signedUrl && <img src={signedUrl} alt={graphic.prompt} className="w-full max-h-[50vh] object-contain rounded-lg" />}

      {showTimeline && <EditTimeline graphicId={graphic.id} />}

      <div className="flex flex-col gap-3">
        {!allowEditing && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Podgląd administratora: możesz przeglądać i pobierać grafiki użytkownika, ale edycja oraz usuwanie są wyłączone.
          </div>
        )}

        {allowEditing && (
          <div className="flex items-center gap-2">
            <Switch
              checked={graphic.is_public}
              onCheckedChange={(checked) => onTogglePublic(graphic, checked)}
            />
            <Label className="flex items-center gap-1 text-sm cursor-pointer">
              <Globe className="w-3.5 h-3.5" /> Publiczna
            </Label>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {allowEditing && (
            <Button variant="outline" size="sm" onClick={() => onShare(graphic)} className="gap-1.5">
              <Share2 className="w-4 h-4" /> Udostępnij
            </Button>
          )}

          {signedUrl && (
            <Button variant="outline" size="sm" onClick={() => onDownload(graphic)} className="gap-1.5">
              <Download className="w-4 h-4" /> Pobierz
            </Button>
          )}

          {allowEditing && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(graphic.id)} className="gap-1.5">
              <Trash2 className="w-4 h-4" /> Usuń
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export default Gallery;
