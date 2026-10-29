import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Image, Eye } from 'lucide-react';
import { vpsFetch } from '@/lib/vpsApi';

type UserGraphic = {
  id: string;
  url: string | null;
  prompt: string;
  style: string;
  created_at: string;
  is_public: boolean;
  signedUrl?: string | null;
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
};

type AdminUser = {
  id: string;
  email: string;
};

type AdminUsersActionResponse = {
  users?: AdminUser[];
};

type GalleryResponse = {
  graphics?: UserGraphic[];
};

export function AdminUserGraphics() {
  const [email, setEmail] = useState('');
  const [graphics, setGraphics] = useState<UserGraphic[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [preview, setPreview] = useState<UserGraphic | null>(null);

  const searchByEmail = async () => {
    if (!email.trim()) { toast.error('Podaj email użytkownika'); return; }
    setLoading(true);
    setSearched(true);

    try {
      const usersData = await vpsFetch<AdminUsersActionResponse>('/admin/users/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list_users' }),
      });
      const normalizedEmail = email.toLowerCase().trim();
      const user = usersData.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);

      if (!user) {
        toast.error('Nie znaleziono użytkownika');
        setGraphics([]);
        return;
      }

      const data = await vpsFetch<GalleryResponse>(`/gallery?filter=all&limit=500&userId=${encodeURIComponent(user.id)}`);
      setGraphics(data.graphics || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się pobrać grafik');
      setGraphics([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" /> Grafiki użytkownika
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Email użytkownika..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === 'Enter' && searchByEmail()}
              />
            </div>
            <Button onClick={searchByEmail} disabled={loading}>
              {loading ? 'Szukam...' : 'Szukaj'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
            </div>
          ) : graphics.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">{graphics.length} grafik</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto">
                {graphics.map((g) => (
                  <div
                    key={g.id}
                    className="relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer group"
                    onClick={() => setPreview(g)}
                  >
                    {(g.thumbnailUrl || g.thumbnail_url || g.signedUrl || g.url) ? (
                      <img
                        src={g.thumbnailUrl || g.thumbnail_url || g.signedUrl || g.url!}
                        alt={g.prompt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        width={360}
                        height={360}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Image className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <p className="text-white text-[10px] line-clamp-2">{g.prompt}</p>
                    </div>
                    {g.is_public && (
                      <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded">Publiczna</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : searched ? (
            <p className="text-sm text-muted-foreground text-center py-8">Brak grafik tego użytkownika</p>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Wpisz email i kliknij "Szukaj"</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-normal text-muted-foreground line-clamp-3 break-all">{preview.prompt}</DialogTitle>
              </DialogHeader>
              {(preview.signedUrl || preview.url) && (
                <img
                  src={preview.signedUrl || preview.url!}
                  alt={preview.prompt}
                  className="w-full max-h-[60vh] object-contain rounded-lg"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Styl: {preview.style} • {new Date(preview.created_at).toLocaleString('pl-PL')}</p>
                <p>Publiczna: {preview.is_public ? 'Tak' : 'Nie'}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
