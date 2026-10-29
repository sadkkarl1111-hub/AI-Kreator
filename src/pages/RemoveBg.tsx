import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowLeft, Coins, Download, Hand, Image, Loader2, Scissors, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { ManualMaskEditor } from '@/components/ManualMaskEditor';
import { AppLayout } from '@/components/AppLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAiModels } from '@/hooks/useAiModels';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToolPricing } from '@/hooks/useToolPricing';
import { getTrimmedGraphicsMessage, saveGraphicToGallery } from '@/lib/graphicsLimit';
import { loadImageFromUrlAsDataUrl, loadUserGalleryImages, readImageFile } from '@/lib/toolImage';
import { vpsFetch } from '@/lib/vpsApi';

const FREE_DAILY_LIMIT = 5;

type FreeUsageResponse = {
  ok: boolean;
  count: number;
};

const RemoveBg = () => {
  const { user } = useAuth();
  const { balance, loading: creditsLoading, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { aiModels, selectedModel, selectedModelOption, setSelectedModel } = useAiModels({ purpose: 'editing' });

  const [sourceBase64, setSourceBase64] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState('image/png');
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [method, setMethod] = useState<'free' | 'ai' | null>(null);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [freeUsedToday, setFreeUsedToday] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ id: string; url: string; prompt: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modelCost = selectedModelOption?.cost ?? 50;
  const { cost: toolCost } = useToolPricing('remove-bg-ai');
  const currentModelCost = toolCost ?? modelCost;

  const fetchFreeUsage = useCallback(async () => {
    if (!user) return;

    try {
      const data = await vpsFetch<FreeUsageResponse>('/me/free-usage/remove_bg');
      setFreeUsedToday(data.count ?? 0);
    } catch (error) {
      console.error(error);
      setFreeUsedToday(0);
    }
  }, [user]);

  useEffect(() => {
    fetchFreeUsage();
  }, [fetchFreeUsage]);

  const incrementFreeUsage = useCallback(async () => {
    const data = await vpsFetch<FreeUsageResponse>('/me/free-usage/remove_bg/increment', {
      method: 'POST',
    });
    setFreeUsedToday(data.count ?? 0);
  }, []);

  const freeRemaining = FREE_DAILY_LIMIT - freeUsedToday;

  const applySourceImage = useCallback((dataUrl: string, mimeType: string) => {
    setShowGallery(false);
    setResultImage(null);
    setSourceBase64(dataUrl.split(',')[1] || '');
    setSourceMime(mimeType);
    setSourcePreview(dataUrl);
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

  const saveResultToGallery = useCallback(async (dataUrl: string, prompt: string) => {
    if (!user) {
      toast.error('Musisz byc zalogowany');
      return false;
    }

    const { trimmedCount } = await saveGraphicToGallery({
      userId: user.id,
      dataUrl,
      prompt,
      style: 'realistic',
      type: 'edited',
    });

    const trimMessage = getTrimmedGraphicsMessage(trimmedCount);
    if (trimMessage) toast.info(trimMessage);

    return true;
  }, [user]);

  const handleRemoveFree = async () => {
    if (!sourceBase64) return;
    if (!isAdmin && freeRemaining <= 0) {
      toast.error('Wykorzystales dzienny limit darmowych usuniec tla. Uzyj wersji AI za kredyty.');
      return;
    }

    setProcessing(true);
    setMethod('free');

    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(`data:${sourceMime};base64,${sourceBase64}`);

      const resultDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Nie udalo sie odczytac wyniku'));
        reader.readAsDataURL(blob);
      });

      const saved = await saveResultToGallery(resultDataUrl, '[Usuniecie tla] Darmowe');
      if (!saved) return;

      setResultImage(resultDataUrl);
      await incrementFreeUsage();
      toast.success('Tlo zostalo usuniete');
    } catch (error) {
      console.error(error);
      toast.error('Nie udalo sie usunac tla');
    } finally {
      setProcessing(false);
      setMethod(null);
    }
  };

  const handleRemoveAI = async () => {
    if (!sourceBase64) return;
    setProcessing(true);
    setMethod('ai');

    try {
      const data = await vpsFetch<{ imageUrl?: string; error?: string }>('/ai/edit-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Remove the background completely and replace it with a solid pure white background (#FFFFFF). Keep only the main subject or object with clean edges.',
          imageBase64: sourceBase64,
          imageMimeType: sourceMime,
          model: selectedModel,
          toolId: 'remove-bg-ai',
        }),
      });

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResultImage(data.imageUrl ?? null);
      refetchCredits();
      toast.success('Tlo zostalo usuniete przez AI');
    } catch (error) {
      console.error(error);
      toast.error('Nie udalo sie usunac tla');
    } finally {
      setProcessing(false);
      setMethod(null);
    }
  };

  const handleManualResult = async (resultDataUrl: string) => {
    setShowManualEditor(false);

    try {
      const saved = await saveResultToGallery(resultDataUrl, '[Usuniecie tla] Reczne');
      if (!saved) return;

      setResultImage(resultDataUrl);
      toast.success('Maska zostala zastosowana');
    } catch (error) {
      console.error(error);
      toast.error('Nie udalo sie zapisac grafiki');
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
      anchor.download = `bez-tla-${Date.now()}.png`;
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
              <Scissors className="inline w-6 h-6 text-primary mr-2" />
              Usun <span className="gradient-text">tlo</span>
            </h1>
            <p className="text-muted-foreground mt-1">Automatyczne usuwanie tla z grafiki.</p>
          </div>
        </div>

        {!isAdmin && (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Darmowe usuwanie tla: <strong>{freeRemaining}/{FREE_DAILY_LIMIT}</strong> pozostalo dzisiaj.
              Wersja AI za kredyty dziala bez limitu.
            </AlertDescription>
          </Alert>
        )}

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
                  <Image className="w-4 h-4" /> Wybierz z galerii
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

        {sourcePreview && showManualEditor && !resultImage && (
          <Card>
            <CardContent className="pt-6">
              <ManualMaskEditor
                imageDataUrl={sourcePreview}
                onApply={handleManualResult}
                onCancel={() => setShowManualEditor(false)}
              />
            </CardContent>
          </Card>
        )}

        {sourcePreview && !resultImage && !showManualEditor && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Podglad obrazu</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSourcePreview(null);
                    setSourceBase64(null);
                  }}
                >
                  Zmien obraz
                </Button>
              </div>

              <div className="rounded-lg overflow-hidden border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                <img src={sourcePreview} alt="Podglad" className="w-full max-h-96 object-contain" />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Model AI (wersja platna)</p>
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  onClick={handleRemoveFree}
                  disabled={processing || (!isAdmin && freeRemaining <= 0)}
                  variant="outline"
                  size="lg"
                  className="h-auto py-4 flex-col items-start gap-1"
                >
                  {processing && method === 'free' ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-lg">FREE</span>}
                  <span className="font-medium">Automatyczne</span>
                  <span className="text-xs text-muted-foreground">
                    {isAdmin ? 'Admin - bez limitu' : `Pozostalo: ${freeRemaining}/${FREE_DAILY_LIMIT}`}
                  </span>
                </Button>
                <Button
                  onClick={() => setShowManualEditor(true)}
                  disabled={processing}
                  variant="outline"
                  size="lg"
                  className="h-auto py-4 flex-col items-start gap-1"
                >
                  <Hand className="w-5 h-5 text-primary" />
                  <span className="font-medium">Reczne</span>
                  <span className="text-xs text-muted-foreground">Pedzel i maska</span>
                </Button>
                <Button
                  onClick={handleRemoveAI}
                  disabled={processing || (!isAdmin && (balance ?? 0) < currentModelCost)}
                  size="lg"
                  className="h-auto py-4 flex-col items-start gap-1 gradient-bg"
                >
                  {processing && method === 'ai' ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-lg">AI</span>}
                  <span className="font-medium">AI (biale tlo)</span>
                  <span className="text-xs opacity-80">{currentModelCost} kr</span>
                </Button>
              </div>

              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Coins className="w-3 h-3" /> Saldo: {isAdmin ? 'inf' : creditsLoading ? '...' : balance?.toLocaleString('pl-PL')} kr
              </p>
            </CardContent>
          </Card>
        )}

        <AnimatePresence>
          {resultImage && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-sm font-medium">Wynik</p>
                  <div className="rounded-lg overflow-hidden border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                    <img src={resultImage} alt="Obraz bez tla" className="w-full max-h-96 object-contain" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleDownload} variant="outline" className="gap-1.5">
                      <Download className="w-4 h-4" /> Pobierz
                    </Button>
                    <Button onClick={() => setResultImage(null)} variant="outline" className="gap-1.5">
                      Sprobuj ponownie
                    </Button>
                    <Button
                      onClick={() => {
                        setSourcePreview(null);
                        setSourceBase64(null);
                        setResultImage(null);
                      }}
                      variant="ghost"
                      className="gap-1.5"
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

export default RemoveBg;
