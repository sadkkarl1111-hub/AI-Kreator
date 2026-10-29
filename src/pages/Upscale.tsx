import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowUpFromLine, Coins, Download, Image, Loader2, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAiModels } from '@/hooks/useAiModels';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToolPricing } from '@/hooks/useToolPricing';
import { loadImageFromUrlAsDataUrl, loadUserGalleryImages, readImageFile } from '@/lib/toolImage';
import { vpsFetch } from '@/lib/vpsApi';

const Upscale = () => {
  const { user } = useAuth();
  const { balance, loading: creditsLoading, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { aiModels, selectedModel, selectedModelOption, setSelectedModel } = useAiModels({ purpose: 'editing' });

  const [sourceBase64, setSourceBase64] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState('image/png');
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [sourceDimensions, setSourceDimensions] = useState<{ w: number; h: number } | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ id: string; url: string; prompt: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modelCost = selectedModelOption?.cost ?? 50;
  const { cost: toolCost } = useToolPricing('upscale');
  const currentModelCost = toolCost ?? modelCost;

  const applySourceImage = useCallback((dataUrl: string, mimeType: string) => {
    const image = new window.Image();
    image.onload = () => {
      setSourceDimensions({ w: image.naturalWidth, h: image.naturalHeight });
      setSourceBase64(dataUrl.split(',')[1] || '');
      setSourceMime(mimeType);
      setSourcePreview(dataUrl);
      setResultImage(null);
      setShowGallery(false);
    };
    image.onerror = () => toast.error('Nie udalo sie zaladowac obrazu');
    image.src = dataUrl;
  }, []);

  const loadGallery = useCallback(async () => {
    if (!user) return;
    const images = await loadUserGalleryImages(null, user.id, 20);
    setGalleryImages(images);
    setShowGallery(true);
  }, [user]);

  const loadImageFromUrl = useCallback(async (url: string) => {
    try {
      const image = await loadImageFromUrlAsDataUrl(url);
      applySourceImage(image.dataUrl, image.mimeType);
    } catch {
      toast.error('Nie udalo sie zaladowac obrazu');
    }
  }, [applySourceImage]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const image = await readImageFile(file, 20);
      applySourceImage(image.dataUrl, image.mimeType);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udalo sie odczytac pliku');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpscale = async () => {
    if (!sourceBase64) return;
    setProcessing(true);

    try {
      const targetW = sourceDimensions ? sourceDimensions.w * 2 : 2048;
      const targetH = sourceDimensions ? sourceDimensions.h * 2 : 2048;

      const data = await vpsFetch<{ imageUrl?: string; error?: string }>('/ai/edit-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: `Upscale this image to ${targetW}x${targetH} pixels. Enhance details, sharpen edges, reduce noise, and improve clarity without changing the composition.`,
          imageBase64: sourceBase64,
          imageMimeType: sourceMime,
          model: selectedModel,
          toolId: 'upscale',
        }),
      });

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResultImage(data.imageUrl ?? null);
      refetchCredits();
      toast.success('Obraz zostal powiekszony');
    } catch (error) {
      console.error(error);
      toast.error('Nie udalo sie powiekszyc obrazu');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!resultImage) return;

    try {
      const response = await fetch(resultImage);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `upscale-${Date.now()}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Nie udalo sie pobrac pliku');
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              <ArrowUpFromLine className="inline w-6 h-6 text-primary mr-2" />
              Powieksz <span className="gradient-text">(Upscale)</span>
            </h1>
            <p className="text-muted-foreground mt-1">Zwieksz rozdzielczosc obrazu z AI.</p>
          </div>
        </div>

        {!sourcePreview && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm font-medium">Wybierz obraz do powiekszenia</p>
              <div className="flex flex-wrap gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" /> Wgraj z dysku
                </Button>
                <Button onClick={loadGallery} variant="outline" className="gap-2">
                  <Image className="w-4 h-4" /> Z galerii
                </Button>
              </div>

              {showGallery && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
                  {galleryImages.length === 0 ? (
                    <p className="col-span-full text-center text-muted-foreground text-sm py-4">Brak grafik</p>
                  ) : (
                    galleryImages.map((graphic) => (
                      <button
                        key={graphic.id}
                        onClick={() => loadImageFromUrl(graphic.url)}
                        className="aspect-square rounded-md overflow-hidden border border-border hover:border-primary transition-colors"
                      >
                        <img src={graphic.url} alt={graphic.prompt} className="w-full h-full object-cover" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {sourcePreview && !resultImage && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Podglad obrazu</p>
                  {sourceDimensions && (
                    <p className="text-xs text-muted-foreground">
                      {sourceDimensions.w} x {sourceDimensions.h} px {'->'} {sourceDimensions.w * 2} x {sourceDimensions.h * 2} px
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSourcePreview(null);
                    setSourceBase64(null);
                    setSourceDimensions(null);
                  }}
                >
                  Zmien obraz
                </Button>
              </div>

              <div className="rounded-lg overflow-hidden border bg-muted/30">
                <img src={sourcePreview} alt="Podglad" className="w-full max-h-96 object-contain" />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Model AI</p>
                <div className="flex flex-wrap gap-2">
                  {aiModels.map((model) => (
                    <Button
                      key={model.id}
                      variant={selectedModel === model.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedModel(model.id)}
                      className={selectedModel === model.id ? 'gradient-bg' : ''}
                    >
                      {model.label} <span className="text-[10px] opacity-70 ml-1">({model.cost} kr)</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Coins className="w-3 h-3" /> Saldo: {isAdmin ? 'inf' : creditsLoading ? '...' : balance?.toLocaleString('pl-PL')} kr
                </p>
              </div>

              <Button
                onClick={handleUpscale}
                disabled={processing || (!isAdmin && (balance ?? 0) < currentModelCost)}
                className="w-full gradient-bg"
                size="lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Powiekszanie...
                  </>
                ) : (
                  <>
                    <ArrowUpFromLine className="w-4 h-4" /> Powieksz 2x ({currentModelCost} kr)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <AnimatePresence>
          {resultImage && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-sm font-medium">Wynik</p>
                  <div className="rounded-lg overflow-hidden border bg-muted/30">
                    <img src={resultImage} alt="Powiekszony obraz" className="w-full" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleDownload} variant="outline" className="gap-1.5">
                      <Download className="w-4 h-4" /> Pobierz
                    </Button>
                    <Button onClick={() => setResultImage(null)} variant="outline">
                      Sprobuj ponownie
                    </Button>
                    <Button
                      onClick={() => {
                        setSourcePreview(null);
                        setSourceBase64(null);
                        setSourceDimensions(null);
                        setResultImage(null);
                      }}
                      variant="ghost"
                    >
                      Nowy obraz
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AppLayout>
  );
};

export default Upscale;
