import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Coins, Download, Image, Loader2, Sparkles, Upload } from 'lucide-react';
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

const STYLES = [
  { id: 'anime', label: 'Anime', prompt: 'Transform this image into anime or manga art with vivid colors, clean lines, and expressive features.' },
  { id: 'oil', label: 'Oil Painting', prompt: 'Transform this image into a classical oil painting with visible brush strokes, rich texture, and dramatic lighting.' },
  { id: 'watercolor', label: 'Akwarela', prompt: 'Transform this image into a delicate watercolor painting with soft washes, flowing colors, and gentle transitions.' },
  { id: 'pixel', label: 'Pixel Art', prompt: 'Transform this image into retro pixel art with visible pixels, a limited palette, and nostalgic 8-bit energy.' },
  { id: 'sketch', label: 'Szkic', prompt: 'Transform this image into a detailed pencil sketch with hatching, cross-hatching, and fine line work.' },
  { id: 'comic', label: 'Komiks', prompt: 'Transform this image into a comic book style with bold outlines, halftone dots, and vibrant flat colors.' },
  { id: '3d', label: '3D Render', prompt: 'Transform this image into a polished 3D render with realistic lighting, depth, and smooth materials.' },
  { id: 'pop', label: 'Pop Art', prompt: 'Transform this image into a pop-art style with bold color blocks, strong contrast, and graphic composition.' },
];

const StyleTransfer = () => {
  const { user } = useAuth();
  const { balance, loading: creditsLoading, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { aiModels, selectedModel, selectedModelOption, setSelectedModel } = useAiModels({ purpose: 'editing' });

  const [sourceBase64, setSourceBase64] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState('image/png');
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ id: string; url: string; prompt: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modelCost = selectedModelOption?.cost ?? 50;
  const { cost: toolCost } = useToolPricing('style-transfer');
  const currentModelCost = toolCost ?? modelCost;

  const loadGallery = useCallback(async () => {
    if (!user) return;
    const images = await loadUserGalleryImages(null, user.id, 20);
    setGalleryImages(images);
    setShowGallery(true);
  }, [user]);

  const applySourceImage = useCallback((dataUrl: string, mimeType: string) => {
    setShowGallery(false);
    setResultImage(null);
    setSourceBase64(dataUrl.split(',')[1] || '');
    setSourceMime(mimeType);
    setSourcePreview(dataUrl);
  }, []);

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

  const handleTransfer = async () => {
    if (!sourceBase64 || !selectedStyle) return;

    const style = STYLES.find((item) => item.id === selectedStyle);
    if (!style) return;

    setProcessing(true);

    try {
      const data = await vpsFetch<{ imageUrl?: string; error?: string }>('/ai/edit-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: style.prompt,
          imageBase64: sourceBase64,
          imageMimeType: sourceMime,
          model: selectedModel,
          toolId: 'style-transfer',
        }),
      });

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResultImage(data.imageUrl ?? null);
      refetchCredits();
      toast.success(`Styl "${style.label}" zostal zastosowany`);
    } catch (error) {
      console.error(error);
      toast.error('Nie udalo sie zmienic stylu');
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
      anchor.download = `styl-${selectedStyle ?? 'ai'}-${Date.now()}.png`;
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
              <Sparkles className="inline w-6 h-6 text-primary mr-2" />
              Zmiana <span className="gradient-text">stylu</span>
            </h1>
            <p className="text-muted-foreground mt-1">Przeksztalc obraz w inny styl artystyczny.</p>
          </div>
        </div>

        {!sourcePreview && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm font-medium">Wybierz obraz</p>
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
                <p className="text-sm font-medium">Podglad</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSourcePreview(null);
                    setSourceBase64(null);
                    setSelectedStyle(null);
                  }}
                >
                  Zmien obraz
                </Button>
              </div>

              <div className="rounded-lg overflow-hidden border bg-muted/30">
                <img src={sourcePreview} alt="Podglad" className="w-full max-h-72 object-contain" />
              </div>

              <p className="text-sm font-medium">Wybierz styl</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STYLES.map((style) => (
                  <Button
                    key={style.id}
                    variant={selectedStyle === style.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedStyle(style.id)}
                    className={`h-auto py-2 ${selectedStyle === style.id ? 'gradient-bg' : ''}`}
                  >
                    {style.label}
                  </Button>
                ))}
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
                onClick={handleTransfer}
                disabled={processing || !selectedStyle || (!isAdmin && (balance ?? 0) < currentModelCost)}
                className="w-full gradient-bg"
                size="lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Przetwarzanie...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Zmien styl ({currentModelCost} kr)
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
                    <img src={resultImage} alt="Wynik stylizacji" className="w-full" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleDownload} variant="outline" className="gap-1.5">
                      <Download className="w-4 h-4" /> Pobierz
                    </Button>
                    <Button onClick={() => setResultImage(null)} variant="outline">
                      Inny styl
                    </Button>
                    <Button
                      onClick={() => {
                        setSourcePreview(null);
                        setSourceBase64(null);
                        setResultImage(null);
                        setSelectedStyle(null);
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

export default StyleTransfer;
