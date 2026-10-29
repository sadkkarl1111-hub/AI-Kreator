import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Image, Loader2, Sparkles, Upload, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useIsAdmin } from '@/hooks/useIsAdmin';
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

const PROMPT_TYPES = [
  { id: 'product', label: 'Produktowy' },
  { id: 'universal', label: 'Uniwersalny' },
  { id: 'social', label: 'Social media' },
  { id: 'logo', label: 'Logo / marka' },
  { id: 'art', label: 'Artystyczny' },
] as const;

const OUTPUT_LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'pl', label: 'Polski' },
] as const;

const AI_IMAGE_PREP = {
  maxDimension: 1600,
  outputMimeType: 'image/jpeg',
  quality: 0.9,
} as const;

const ImageToPrompt = () => {
  const { user } = useAuth();
  const { balance, loading: creditsLoading, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { cost: configuredCost } = useToolPricing('image-to-prompt');

  const [selectedImage, setSelectedImage] = useState<SelectedToolImage | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryToolImage[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [promptType, setPromptType] = useState<(typeof PROMPT_TYPES)[number]['id']>('product');
  const [outputLanguage, setOutputLanguage] = useState<(typeof OUTPUT_LANGUAGES)[number]['id']>('en');
  const [resultPrompt, setResultPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const toolCost = configuredCost ?? 25;

  const handleFileUpload = async (file: File) => {
    try {
      const image = await readImageFile(file, 12, AI_IMAGE_PREP);
      setSelectedImage(image);
      setResultPrompt('');
      setShowGallery(false);
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
      setResultPrompt('');
      setShowGallery(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się załadować obrazu z galerii');
    }
  };

  const generatePrompt = async () => {
    if (!selectedImage) return;

    if (!isAdmin && (balance ?? 0) < toolCost) {
      toast.error('Masz za mało kredytów na to narzędzie');
      return;
    }

    setLoading(true);
    setResultPrompt('');

    try {
      const data = await vpsFetch<{ prompt?: string; error?: string }>('/ai/image-to-prompt', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: selectedImage.base64,
          imageMimeType: selectedImage.mimeType,
          promptType,
          outputLanguage,
          toolId: 'image-to-prompt',
        }),
      });

      if (data?.error) throw new Error(data.error);

      setResultPrompt(data.prompt || '');
      refetchCredits();
      toast.success('Prompt został wygenerowany');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wygenerować promptu');
    } finally {
      setLoading(false);
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
              <Wand2 className="w-6 h-6 text-primary" /> Image to Prompt
            </h1>
            <p className="text-sm text-muted-foreground">
              Wrzucasz obraz, a AI zamienia go w gotowy prompt do dalszej generacji.
            </p>
          </div>
        </div>

        <Alert>
          <Sparkles className="w-4 h-4" />
          <AlertDescription>
            Narzędzie najlepiej działa dla zdjęć produktów, reklam, referencji stylu i obrazów, które chcesz odtworzyć podobnym promptem.
          </AlertDescription>
        </Alert>

        <Alert>
          <AlertDescription>
            Obraz jest automatycznie zmniejszany przed wysyłką, żeby ograniczyć błędy po stronie Edge Function.
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
                    <Image className="w-4 h-4" /> Wybierz z galerii
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
                  <p className="text-sm font-medium">Wybrany obraz</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedImage(null);
                      setResultPrompt('');
                      setShowGallery(false);
                    }}
                  >
                    Zmień obraz
                  </Button>
                </div>
                <div className="rounded-xl border overflow-hidden bg-muted/20">
                  <img src={selectedImage.dataUrl} alt="Wybrane źródło" className="w-full max-h-[360px] object-contain" />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-sm font-medium">Typ promptu</label>
              <div className="flex flex-wrap gap-2">
                {PROMPT_TYPES.map((type) => (
                  <Button
                    key={type.id}
                    variant={promptType === type.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPromptType(type.id)}
                    className={promptType === type.id ? 'gradient-bg' : ''}
                  >
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Język promptu</label>
              <div className="flex flex-wrap gap-2">
                {OUTPUT_LANGUAGES.map((language) => (
                  <Button
                    key={language.id}
                    variant={outputLanguage === language.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOutputLanguage(language.id)}
                    className={outputLanguage === language.id ? 'gradient-bg' : ''}
                  >
                    {language.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border bg-muted/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Koszt: <span className="font-medium text-foreground">{isAdmin ? '∞' : `${toolCost} kr`}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Saldo: <span className="font-medium text-foreground">{isAdmin ? '∞' : creditsLoading ? '...' : `${balance ?? 0} kr`}</span>
              </p>
            </div>

            <Button
              onClick={generatePrompt}
              disabled={!selectedImage || loading}
              className="w-full gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {loading ? 'Generuję prompt...' : 'Wygeneruj prompt'}
            </Button>

            {resultPrompt && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">Gotowy prompt</label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(resultPrompt);
                      toast.success('Prompt skopiowany');
                    }}
                  >
                    <Copy className="w-3 h-3" /> Kopiuj
                  </Button>
                </div>
                <Textarea
                  value={resultPrompt}
                  onChange={(event) => setResultPrompt(event.target.value)}
                  className="min-h-[220px] text-sm"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default ImageToPrompt;
