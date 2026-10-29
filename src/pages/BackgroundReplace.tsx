import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Coins, Download, Image as ImageIcon, Loader2, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAiModels } from '@/hooks/useAiModels';
import { useToolPricing } from '@/hooks/useToolPricing';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { vpsFetch } from '@/lib/vpsApi';
import {
  type GalleryToolImage,
  type SelectedToolImage,
  loadImageFromUrlAsDataUrl,
  loadUserGalleryImages,
  readImageFile,
} from '@/lib/toolImage';

const BACKGROUND_PRESETS = [
  {
    id: 'studio-white',
    label: 'Studio białe',
    prompt: 'a clean white studio background with soft professional product lighting and subtle realistic floor shadow',
  },
  {
    id: 'office',
    label: 'Biuro',
    prompt: 'a premium modern office interior with natural daylight, elegant desk details, and soft depth of field',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    prompt: 'a luxury interior background with refined textures, warm light, premium styling, and tasteful blur behind the subject',
  },
  {
    id: 'beach',
    label: 'Plaża',
    prompt: 'a bright beach scene with soft sand, calm sea tones, clear daylight, and natural depth behind the subject',
  },
  {
    id: 'forest',
    label: 'Las',
    prompt: 'a lush forest background with cinematic green tones, soft sunlight rays, and realistic natural atmosphere',
  },
  {
    id: 'neon',
    label: 'Neon city',
    prompt: 'a modern neon-lit city background with cinematic reflections, urban depth, and vibrant but tasteful color accents',
  },
] as const;

const AI_IMAGE_PREP = {
  maxDimension: 1600,
  outputMimeType: 'image/jpeg',
  quality: 0.9,
} as const;

const BackgroundReplace = () => {
  const { user } = useAuth();
  const { balance, loading: creditsLoading, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { aiModels, selectedModel, selectedModelOption, setSelectedModel } = useAiModels({ purpose: 'editing' });
  const { cost: configuredCost } = useToolPricing('background-replace');

  const [selectedImage, setSelectedImage] = useState<SelectedToolImage | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryToolImage[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<(typeof BACKGROUND_PRESETS)[number]['id']>('studio-white');
  const [extraNotes, setExtraNotes] = useState('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const modelCost = selectedModelOption?.cost ?? 50;
  const toolCost = configuredCost ?? modelCost;
  const selectedPreset = BACKGROUND_PRESETS.find((preset) => preset.id === selectedPresetId) ?? BACKGROUND_PRESETS[0];

  const handleFileUpload = async (file: File) => {
    try {
      const image = await readImageFile(file, 20, AI_IMAGE_PREP);
      setSelectedImage(image);
      setShowGallery(false);
      setResultImage(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wczytać obrazu');
    }
  };

  const loadGallery = useCallback(async () => {
    if (!user) return;
    const images = await loadUserGalleryImages(null, user.id, 24);
    setGalleryImages(images);
    setShowGallery(true);
  }, [user]);

  const selectFromGallery = async (url: string) => {
    try {
      const image = await loadImageFromUrlAsDataUrl(url, AI_IMAGE_PREP);
      setSelectedImage(image);
      setShowGallery(false);
      setResultImage(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się załadować obrazu z galerii');
    }
  };

  const replaceBackground = async () => {
    if (!selectedImage) return;

    if (!isAdmin && (balance ?? 0) < toolCost) {
      toast.error('Masz za mało kredytów na podmianę tła');
      return;
    }

    const prompt = [
      'Replace only the background of this image.',
      'Keep the main subject exactly the same: same face, body, pose, clothing, product details, colors, proportions, perspective, and subject lighting.',
      'Do not alter the subject and do not add extra objects touching the subject.',
      `Use this new background: ${selectedPreset.prompt}.`,
      extraNotes.trim() ? `Additional notes: ${extraNotes.trim()}.` : '',
      'Blend the new background naturally and keep clean subject edges.',
    ].filter(Boolean).join(' ');

    setLoading(true);
    setResultImage(null);

    try {
      const data = await vpsFetch<{ imageUrl?: string | null; error?: string }>('/ai/edit-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          imageBase64: selectedImage.base64,
          imageMimeType: selectedImage.mimeType,
          model: selectedModel,
          toolId: 'background-replace',
        }),
      });

      if (data?.error) throw new Error(data.error);

      setResultImage(data.imageUrl || null);
      refetchCredits();
      toast.success('Tło zostało podmienione');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się podmienić tła');
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = async () => {
    if (!resultImage) return;

    try {
      const response = await fetch(resultImage);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `background-replace-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Nie udało się pobrać obrazu');
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-primary" /> Background Replace
            </h1>
            <p className="text-sm text-muted-foreground">
              Podmień samo tło bez zmieniania osoby, produktu albo głównego obiektu na zdjęciu.
            </p>
          </div>
        </div>

        <Alert>
          <Sparkles className="w-4 h-4" />
          <AlertDescription>
            Narzędzie najlepiej działa dla portretów, zdjęć produktowych i grafik z wyraźnym głównym obiektem.
          </AlertDescription>
        </Alert>

        <Alert>
          <AlertDescription>
            Obraz jest automatycznie zmniejszany przed wysyłką do AI, żeby ograniczyć błędy przy większych plikach.
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {!selectedImage ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) handleFileUpload(file);
                        event.target.value = '';
                      }}
                    />
                    <Button asChild variant="outline" className="gap-2 cursor-pointer">
                      <span><Upload className="w-4 h-4" /> Wgraj obraz</span>
                    </Button>
                  </label>
                  <Button onClick={loadGallery} variant="outline" className="gap-2">
                    <ImageIcon className="w-4 h-4" /> Wybierz z galerii
                  </Button>
                </div>

                {showGallery && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 rounded-xl border p-3">
                    {galleryImages.length === 0 ? (
                      <p className="col-span-full text-sm text-muted-foreground text-center py-6">Brak grafik w galerii</p>
                    ) : (
                      galleryImages.map((graphic) => (
                        <button
                          key={graphic.id}
                          type="button"
                          onClick={() => selectFromGallery(graphic.url)}
                          className="aspect-square overflow-hidden rounded-lg border hover:border-primary transition-colors"
                        >
                          <img src={graphic.url} alt={graphic.prompt} className="w-full h-full object-cover" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">Obraz źródłowy</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedImage(null);
                      setResultImage(null);
                      setShowGallery(false);
                    }}
                  >
                    Zmień obraz
                  </Button>
                </div>
                <div className="rounded-xl border overflow-hidden bg-muted/20">
                  <img src={selectedImage.dataUrl} alt="Źródło" className="w-full max-h-[360px] object-contain" />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-sm font-medium">Scena docelowa</label>
              <div className="flex flex-wrap gap-2">
                {BACKGROUND_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    variant={selectedPresetId === preset.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={selectedPresetId === preset.id ? 'gradient-bg' : ''}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Dodatkowe wskazówki</label>
              <Textarea
                value={extraNotes}
                onChange={(event) => setExtraNotes(event.target.value)}
                placeholder="Np. tło ma być bardzo jasne, bardziej premium, bardziej naturalne, bez ludzi w tle..."
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Model AI</label>
              <div className="flex flex-wrap gap-2">
                {aiModels.map((model) => (
                  <Button
                    key={model.id}
                    variant={selectedModel === model.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedModel(model.id)}
                    className={selectedModel === model.id ? 'gradient-bg' : ''}
                  >
                    {model.label} <span className="ml-1 text-[10px] opacity-70">({model.cost} kr)</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border bg-muted/20 px-4 py-3">
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Coins className="w-4 h-4" /> Koszt: <span className="font-medium text-foreground">{isAdmin ? '∞' : `${toolCost} kr`}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Saldo: <span className="font-medium text-foreground">{isAdmin ? '∞' : creditsLoading ? '...' : `${balance ?? 0} kr`}</span>
              </p>
            </div>

            <Button
              onClick={replaceBackground}
              disabled={!selectedImage || loading}
              className="w-full gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Podmieniam tło...' : 'Podmień tło'}
            </Button>

            {resultImage && (
              <div className="space-y-4">
                <div className="rounded-xl border overflow-hidden bg-muted/20">
                  <img src={resultImage} alt="Wynik podmiany tła" className="w-full max-h-[420px] object-contain" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={downloadResult} variant="outline" className="gap-2">
                    <Download className="w-4 h-4" /> Pobierz wynik
                  </Button>
                  <Button onClick={() => setResultImage(null)} variant="outline">
                    Spróbuj ponownie
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default BackgroundReplace;
