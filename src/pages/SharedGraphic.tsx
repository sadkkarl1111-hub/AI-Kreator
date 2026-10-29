import { useEffect, useState } from 'react';
import { Download, Image, Palette } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { vpsPublicFetch } from '@/lib/vpsApi';

type SharedGraphicData = {
  url: string | null;
  prompt: string;
  style: string;
  created_at: string;
  signed_url: string | null;
};

type SharedGraphicResponse = {
  ok: boolean;
  graphic: SharedGraphicData | null;
};

const SharedGraphic = () => {
  const { token } = useParams<{ token: string }>();
  const [graphic, setGraphic] = useState<SharedGraphicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    vpsPublicFetch<SharedGraphicResponse>(`/public/shared-graphic/${token}`)
      .then((response) => {
        if (cancelled) return;
        setGraphic(response.graphic ?? null);
        setNotFound(!response.graphic);
      })
      .catch(() => {
        if (cancelled) return;
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleDownload = async () => {
    if (!graphic?.signed_url) return;

    const response = await fetch(graphic.signed_url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `grafika-${Date.now()}.png`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Ladowanie...</p>
      </div>
    );
  }

  if (notFound || !graphic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Image className="w-16 h-16 text-muted-foreground" />
        <p className="text-lg font-medium">Grafika nie zostala znaleziona</p>
        <p className="text-sm text-muted-foreground">Link moze byc nieaktywny lub grafika zostala usunieta.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-2 justify-center">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
            <Palette className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg gradient-text">Kreator Grafik AI</span>
        </div>

        <Card className="overflow-hidden">
          {graphic.signed_url ? (
            <img src={graphic.signed_url} alt={graphic.prompt} className="w-full" />
          ) : (
            <div className="aspect-square flex items-center justify-center bg-muted">
              <Image className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
          <CardContent className="p-4 space-y-2">
            <p className="text-sm text-muted-foreground">{graphic.prompt}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Styl: {graphic.style} · {new Date(graphic.created_at).toLocaleDateString('pl-PL')}
              </span>
              {graphic.signed_url && (
                <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5">
                  <Download className="w-3 h-3" /> Pobierz
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SharedGraphic;
