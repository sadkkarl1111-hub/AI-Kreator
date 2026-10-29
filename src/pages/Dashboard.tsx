import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { AppLayout } from '@/components/AppLayout';
import { PublicGallery } from '@/components/PublicGallery';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Wand2, Palette, Image, Sparkles, Coins, Copy, Download, BriefcaseBusiness, Lock, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { vpsFetch } from '@/lib/vpsApi';

type Graphic = {
  id: string;
  url: string | null;
  prompt: string;
  style: string;
  type: string;
  created_at: string;
  signed_url: string | null;
  thumbnail_url?: string | null;
};

const Dashboard = () => {
  const [recentGraphics, setRecentGraphics] = useState<Graphic[]>([]);
  const [selectedGraphic, setSelectedGraphic] = useState<Graphic | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { balance, loading: creditsLoading } = useCredits();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    if (!user) {
      queueMicrotask(()=>setLoading(false));
      return;
    }

    vpsFetch<{ ok: boolean; graphics: Graphic[] }>('/me/graphics?limit=6')
      .then((data) => {
        setRecentGraphics(data.graphics || []);
      })
      .catch(() => {
        setRecentGraphics([]);
        toast.error('Nie udało się pobrać ostatnich grafik');
      })
      .finally(() => {
        setLoading(false);
      });

  }, [user]);


  const quickActions = [
    { to: '/generator', label: 'Generator AI', desc: 'Stwórz grafikę z opisu', icon: Wand2, color: 'from-primary to-accent' },
    {
      to: '/generator-reklam',
      label: 'Generator reklam',
      desc: 'Darmowe prompty · 1 zestaw co 7 dni',
      icon: Megaphone,
      color: 'from-orange-500 to-pink-500',
      locked: false,
    },
    ...(isAdmin
      ? [{ to: '/company-assistant', label: 'Asystent firmy', desc: 'Pakiety, wizytówki i brandbook', icon: BriefcaseBusiness, color: 'from-accent to-primary' }]
      : []),
    { to: '/templates', label: 'Szablony', desc: 'Gotowe szablony social media', icon: Palette, color: 'from-secondary to-primary' },
    { to: '/gallery', label: 'Moja galeria', desc: 'Przeglądaj zapisane grafiki', icon: Image, color: 'from-accent to-secondary' },
    { to: '/credits', label: 'Kredyty', desc: 'Zarządzaj i kupuj kredyty', icon: Coins, color: 'from-primary to-secondary' },
  ];

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">
            Cześć! <span className="gradient-text">Twórz z AI</span> <Sparkles className="inline w-6 h-6 text-primary" />
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground">Co chcesz dziś stworzyć?</p>
            {!creditsLoading && (
              <span className="text-sm font-medium flex items-center gap-1 text-primary">
                <Coins className="w-4 h-4" /> {isAdmin ? '∞ (admin)' : `${balance?.toLocaleString('pl-PL')} kr`}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map(({ to, label, desc, icon: Icon, color, locked }, i) => (
            <motion.div key={to} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Link to={to}>
                <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-0 overflow-hidden">
                  <div className={`h-2 bg-gradient-to-r ${color}`} />
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${color} text-primary-foreground`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors flex items-center gap-1.5">
                          {label}
                          {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                        </h3>
                        <p className="text-sm text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Ostatnie grafiki</h2>
            {recentGraphics.length > 0 && (
              <Link to="/gallery">
                <Button variant="ghost" size="sm">Zobacz wszystkie</Button>
              </Link>
            )}
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : recentGraphics.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Wand2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nie masz jeszcze żadnych grafik</p>
                <Link to="/generator">
                  <Button className="mt-4 gradient-bg">Stwórz pierwszą grafikę</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {recentGraphics.map((g, i) => (
                <motion.div key={g.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                  <Card
                    className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedGraphic(g)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedGraphic(g);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="aspect-square bg-muted relative">
                      {(g.thumbnail_url || g.signed_url) ? (
                        <img
                          src={g.thumbnail_url || g.signed_url || ''}
                          alt={g.prompt}
                          className="w-full h-full object-cover"
                          loading={i === 0 ? 'eager' : 'lazy'}
                          fetchPriority={i === 0 ? 'high' : 'auto'}
                          decoding="async"
                          width={360}
                          height={360}
                          sizes="(min-width: 768px) 33vw, 50vw"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Image className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(g.prompt);
                            toast.success('Prompt skopiowany!');
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        {g.signed_url && (
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const res = await fetch(g.signed_url!);
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `grafika-${Date.now()}.png`;
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch {
                                toast.error('Nie udało się pobrać');
                              }
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <p className="text-xs text-muted-foreground truncate">{g.prompt}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs gap-1.5"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigator.clipboard.writeText(g.prompt);
                          toast.success('Prompt skopiowany!');
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" /> Kopiuj prompt
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={!!selectedGraphic} onOpenChange={(open) => { if (!open) setSelectedGraphic(null); }}>
          <DialogContent className="max-w-2xl w-[min(95vw,42rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden">
            {selectedGraphic && <SelectedDashboardGraphicDialog graphic={selectedGraphic} />}
          </DialogContent>
        </Dialog>

        <PublicGallery />
      </motion.div>
    </AppLayout>
  );
};

function SelectedDashboardGraphicDialog({ graphic }: { graphic: Graphic }) {
  const signedUrl = graphic.signed_url;

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(graphic.prompt);
    toast.success('Prompt skopiowany!');
  };

  const handleDownload = async () => {
    if (!signedUrl) {
      toast.error('Grafika nie jest jeszcze gotowa do pobrania');
      return;
    }

    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `grafika-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error('Nie udało się pobrać grafiki');
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-sm font-normal text-muted-foreground flex items-start gap-2 max-w-full min-w-0">
          <span className="min-w-0 flex-1 break-words whitespace-normal">{graphic.prompt}</span>
          <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs" onClick={copyPrompt}>
            <Copy className="w-3 h-3" /> Kopiuj
          </Button>
        </DialogTitle>
      </DialogHeader>

      {signedUrl ? (
        <img src={signedUrl} alt={graphic.prompt} className="w-full max-h-[55vh] object-contain rounded-lg" />
      ) : (
        <Skeleton className="w-full h-[320px] rounded-lg" />
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={copyPrompt}>
          <Copy className="w-4 h-4" /> Kopiuj prompt
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload} disabled={!signedUrl}>
          <Download className="w-4 h-4" /> Pobierz
        </Button>
      </div>
    </>
  );
}

export default Dashboard;
