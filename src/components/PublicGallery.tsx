import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { ArrowRight, Image, PenLine, Sparkles, Trash2, Copy, ZoomIn } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { vpsFetch, vpsPublicFetch } from '@/lib/vpsApi';

type PublicGraphic = {
  id: string;
  url: string | null;
  prompt: string;
  style: string;
  created_at: string;
  user_id: string | null;
  signed_url?: string | null;
  thumbnail_url?: string | null;
};

type PublicGalleryResponse = {
  ok: boolean;
  graphics: PublicGraphic[];
};

type PublicGalleryProps = {
  limit?: number;
  title?: string;
  className?: string;
};

export function PublicGallery({
  limit = 12,
  title = 'Galeria publicznych grafik AI',
  className = 'w-full max-w-2xl mx-auto',
}: PublicGalleryProps = {}) {
  const [graphics, setGraphics] = useState<PublicGraphic[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PublicGraphic | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<PublicGraphic | null>(null);
  const { isAdmin } = useIsAdmin();

  const fetchGraphics = () => {
    setLoading(true);
    vpsPublicFetch<PublicGalleryResponse>(`/public/gallery?limit=${encodeURIComponent(String(limit))}`)
      .then((data) => {
        setGraphics(data.graphics || []);
      })
      .catch(() => {
        toast.error('Nie udało się pobrać galerii publicznej');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => { fetchGraphics(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await vpsFetch('/admin/public-gallery/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'hide', graphicId: deleteTarget.id }),
      });
      toast.success('Grafika usunięta z galerii publicznej');
      setGraphics(prev => prev.filter(g => g.id !== deleteTarget.id));
    } catch {
      toast.error('Nie udało się usunąć grafiki z galerii publicznej');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast.success('Prompt skopiowany!');
  };

  const remixPrompt = (prompt: string) => {
    window.sessionStorage.setItem('promptGeneratorProSeedPrompt', prompt);
    toast.success('Prompt gotowy do remiksu');
  };

  const getImageUrl = (graphic: PublicGraphic) => graphic.signed_url || graphic.url;
  const getThumbnailUrl = (graphic: PublicGraphic) => graphic.thumbnail_url || getImageUrl(graphic);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: Math.min(Math.max(limit, 4), 12) }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }

  if (graphics.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {title && (
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          {title}
        </h2>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {graphics.map((g, i) => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card
              className="overflow-hidden group hover:shadow-lg transition-all relative cursor-pointer"
              onClick={() => setSelected(g)}
            >
              <div className="aspect-square bg-muted relative">
                {getThumbnailUrl(g) ? (
                  <img
                    src={getThumbnailUrl(g) || ''}
                    alt={g.prompt}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    decoding="async"
                    width={360}
                    height={360}
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Image className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <p className="text-white text-xs line-clamp-3">{g.prompt}</p>
                </div>
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                </div>
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(g);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background border-border">
          {selected && (
            <div className="flex max-h-[86vh] flex-col md:flex-row">
              <div className="flex min-h-[260px] flex-1 items-center justify-center bg-muted md:min-h-[420px]">
                {getImageUrl(selected) ? (
                  <img
                    src={getImageUrl(selected) || ''}
                    alt={selected.prompt}
                    className="max-h-[86vh] w-full object-contain"
                  />
                ) : (
                  <Image className="w-16 h-16 text-muted-foreground" />
                )}
              </div>
              <div className="flex min-h-0 w-full flex-col gap-3 p-5 md:w-80">
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Styl</span>
                  <p className="text-sm font-medium mt-0.5">{selected.style}</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-muted/20 p-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prompt</span>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{selected.prompt}</p>
                </div>
                <div className="grid gap-2 border-t pt-3">
                  <Button
                    asChild
                    size="sm"
                    className="gap-1.5"
                    onClick={() => remixPrompt(selected.prompt)}
                  >
                    <Link to="/tools/prompt-generator">
                      <PenLine className="w-3.5 h-3.5" />
                      Remiksuj prompt
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => copyPrompt(selected.prompt)}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Kopiuj prompt
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń z galerii publicznej</AlertDialogTitle>
            <AlertDialogDescription>
              Grafika zostanie ukryta z galerii publicznej (właściciel nadal będzie ją widział w swojej galerii).
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">Prompt: {deleteTarget?.prompt}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Usuwanie...' : 'Usuń z publicznej'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
