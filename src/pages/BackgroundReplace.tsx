import { useCallback, useEffect, useRef, useState } from 'react';
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
import { saveLocalBlob } from '@/lib/localDesignExport';
import { PRODUCT_SCENES, PRODUCT_POSES, PRODUCT_FORMATS, buildProductPhotoPrompt } from '@/lib/productPhotography';
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

type ProductPose = typeof PRODUCT_POSES[number];
type ProductResult = { pose: ProductPose; url: string };

const BackgroundReplace = ({ productMode = false, adMode = false }: { productMode?: boolean; adMode?: boolean }) => {
  const { user } = useAuth();
  const { balance, loading: creditsLoading, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { aiModels, selectedModel, selectedModelOption, setSelectedModel } = useAiModels({ purpose: 'editing' });
  const { cost: configuredCost } = useToolPricing('background-replace');

  const [selectedImage, setSelectedImage] = useState<SelectedToolImage | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryToolImage[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('studio-white');
  const [extraNotes, setExtraNotes] = useState('');
  const [poseIds, setPoseIds] = useState<ProductPose['id'][]>(['angle']);
  const [seriesMode, setSeriesMode] = useState(false);
  const [productFormat, setProductFormat] = useState(adMode ? '1536x1024' : '');
  const [copySpace, setCopySpace] = useState<'left' | 'right'>('left');
  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [shotProgress, setShotProgress] = useState(0);
  const [seriesError, setSeriesError] = useState('');
  const resumeSeries = useRef('');
  const [packing, setPacking] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generating = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const modelCost = selectedModelOption?.cost ?? 50;
  const toolCost = productMode ? modelCost : configuredCost ?? modelCost;
  const totalCost = productMode ? toolCost * poseIds.length : toolCost;
  const presets = productMode ? PRODUCT_SCENES.filter(preset => !adMode || preset.id !== 'catalog') : BACKGROUND_PRESETS;
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? presets[0];

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
    try {
      const images = await loadUserGalleryImages(null, user.id, 24);
      setGalleryImages(images);
      setShowGallery(true);
    } catch {
      toast.error('Nie udało się wczytać galerii. Spróbuj ponownie.');
    }
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
    if (!selectedImage || generating.current || (productMode && !poseIds.length)) return;

    if (!isAdmin && (balance ?? 0) < totalCost) {
      toast.error('Masz za mało kredytów na wybrane ujęcia');
      return;
    }

    const backgroundPrompt = [
      'Replace only the background of this image.',
      'Keep the main subject exactly the same: same face, body, pose, clothing, product details, colors, proportions, perspective, and subject lighting.',
      'Do not alter the subject and do not add extra objects touching the subject.',
      `Use this new background: ${selectedPreset.prompt}.`,
      extraNotes.trim() ? `Additional notes: ${extraNotes.trim()}.` : '',
      'Blend the new background naturally and keep clean subject edges.',
    ].filter(Boolean).join(' ');

    const generate = async (prompt: string) => {
      const data = await vpsFetch<{ imageUrl?: string | null; error?: string }>('/ai/edit-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          imageBase64: selectedImage.base64,
          imageMimeType: selectedImage.mimeType,
          model: selectedModel,
          toolId: adMode ? 'ad-photo' : productMode ? 'product-photos' : 'background-replace',
          ...(productMode && { expectedCreditCost: modelCost, dimensions: productFormat || undefined }),
        }),
      });

      if (data?.error) throw new Error(data.error);
      if (!data.imageUrl) throw new Error('Nie otrzymano zdjęcia. Spróbuj ponownie.');
      return data.imageUrl;
    };

    generating.current = true;
    setLoading(true);
    setResultImage(null);
    setSeriesError('');
    const seriesKey = (ids: typeof poseIds) => JSON.stringify([selectedPresetId, selectedModel, productFormat, extraNotes, ids]);
    const keepPrevious = seriesMode && resumeSeries.current === seriesKey(poseIds);
    resumeSeries.current = '';
    let completed = 0;
    try {
      if (productMode) {
        const shots = poseIds.map(id => PRODUCT_POSES.find(pose => pose.id === id)!);
        for (const pose of shots) {
          if (!mounted.current) return;
          setShotProgress(completed + 1);
          const url = await generate(buildProductPhotoPrompt(selectedPreset.prompt, extraNotes, pose.prompt, adMode ? copySpace : undefined));
          completed++;
          const replacePrevious = completed === 1 && !keepPrevious;
          setProductResults(previous => replacePrevious ? [{ pose, url }] : [...previous, { pose, url }]);
        }
        toast.success('Gotowe zdjęcia znajdziesz też w galerii.');
      } else {
        setResultImage(await generate(backgroundPrompt));
        toast.success('Tło zostało podmienione');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się wygenerować obrazu';
      if (productMode) {
        setSeriesError(`Gotowe ujęcia w tej próbie: ${completed} z ${poseIds.length}. ${message}`);
        if (seriesMode && (completed || keepPrevious)) {
          const remaining = poseIds.slice(completed);
          resumeSeries.current = seriesKey(remaining);
          setPoseIds(remaining);
        }
      } else toast.error(message);
    } finally {
      await refetchCredits();
      generating.current = false;
      setLoading(false);
    }
  };

  const loadDownload = async (imageUrl: string, name: string) => {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Nie udało się pobrać obrazu');
    const blob = await response.blob();
    const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
    return { blob, filename: `${name}.${extension}` };
  };

  const downloadResult = async (imageUrl: string, name: string) => {
    try {
      const { blob, filename } = await loadDownload(imageUrl, name);
      saveLocalBlob(blob, filename);
    } catch {
      toast.error('Nie udało się pobrać obrazu');
    }
  };

  const downloadSeries = async () => {
    setPacking(true);
    try {
      const { zipSync } = await import('fflate');
      const files: Record<string, Uint8Array> = {};
      for (const [index, result] of productResults.entries()) {
        const { blob, filename } = await loadDownload(result.url, `zdjecie-${index + 1}-${result.pose.id}`);
        files[filename] = new Uint8Array(await blob.arrayBuffer());
      }
      saveLocalBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), 'zdjecia-produktowe.zip');
    } catch {
      toast.error('Nie udało się pobrać serii. Spróbuj ponownie lub pobierz zdjęcia osobno.');
    } finally {
      setPacking(false);
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
              <ImageIcon className="w-6 h-6 text-primary" /> {adMode ? 'Zdjęcie reklamowe z miejscem na tekst' : productMode ? 'Zdjęcia produktowe AI' : 'Background Replace'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {adMode ? 'Wybierz, po której stronie zostawić wolne miejsce na nagłówek i cenę. AI przygotuje kompozycję zdjęcia.' : productMode ? 'Wgraj zdjęcie produktu, wybierz scenerię i przygotuj fotografię do sklepu lub reklamy.' : 'Podmień samo tło bez zmieniania osoby, produktu albo głównego obiektu na zdjęciu.'}
            </p>
          </div>
        </div>

        <Alert>
          <Sparkles className="w-4 h-4" />
          <AlertDescription>
            {productMode ? 'Najlepsze efekty daje ostre zdjęcie jednego produktu widocznego w całości. Po generowaniu sprawdź logo, napisy i detale produktu.' : 'Narzędzie najlepiej działa dla portretów, zdjęć produktowych i grafik z wyraźnym głównym obiektem.'}
          </AlertDescription>
        </Alert>

        <Alert>
          <AlertDescription>
            {productMode ? 'Wybierz plik do 20 MB. Gotowe zdjęcie zostanie również zapisane w Twojej galerii.' : 'Obraz jest automatycznie zmniejszany przed wysyłką do AI, żeby ograniczyć błędy przy większych plikach.'}
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <fieldset disabled={loading} className="space-y-5 min-w-0">
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
                      <span><Upload className="w-4 h-4" /> {productMode ? 'Wgraj zdjęcie produktu' : 'Wgraj obraz'}</span>
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
                      setProductResults([]);
                      setSeriesError('');
                      resumeSeries.current = '';
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
                {presets.map((preset) => (
                  <Button
                    key={preset.id}
                    variant={selectedPresetId === preset.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPresetId(preset.id)}
                    aria-pressed={selectedPresetId === preset.id}
                    className={selectedPresetId === preset.id ? 'gradient-bg' : ''}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {adMode && (
              <div className="space-y-3">
                <label className="grid gap-2 text-sm font-medium">
                  Miejsce na tekst
                  <select className="min-h-11 rounded-md border bg-background px-3 sm:w-64" value={copySpace} onChange={event => setCopySpace(event.target.value === 'left' ? 'left' : 'right')}>
                    <option value="left">Po lewej · produkt po prawej</option>
                    <option value="right">Po prawej · produkt po lewej</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Format reklamy
                  <select className="min-h-11 rounded-md border bg-background px-3 sm:w-64" value={productFormat} onChange={event => setProductFormat(event.target.value)}>
                    {PRODUCT_FORMATS.filter(format => format.value).map(format => <option key={format.value} value={format.value}>{format.label}</option>)}
                  </select>
                </label>
              </div>
            )}
            {productMode && !adMode && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-medium">Pozycja produktu i perspektywa</h2>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={seriesMode} onChange={event => {
                      setSeriesMode(event.target.checked);
                      setPoseIds(previous => [previous[0] ?? 'angle']);
                    }} />
                    Seria ujęć
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PRODUCT_POSES.map((pose) => (
                    <Button key={pose.id} variant={poseIds.includes(pose.id) ? 'default' : 'outline'}
                      className="min-h-11"
                      aria-pressed={poseIds.includes(pose.id)}
                      disabled={seriesMode && poseIds.length >= 3 && !poseIds.includes(pose.id)}
                      onClick={() => setPoseIds(previous => {
                        if (!seriesMode) return [pose.id];
                        if (previous.includes(pose.id)) return previous.filter(id => id !== pose.id);
                        return previous.length < 3 ? [...previous, pose.id] : previous;
                      })}>
                      {pose.label}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{seriesMode ? 'Wybierz do trzech ujęć. Każde powstanie jako osobne zdjęcie w tej samej scenerii.' : 'Włącz serię, aby wybrać kilka ujęć tego samego produktu.'}</p>
                <label className="grid gap-2 text-sm font-medium">
                  Format zdjęcia
                  <select className="min-h-11 w-full rounded-md border bg-background px-3 sm:w-64" value={productFormat} onChange={event => setProductFormat(event.target.value)}>
                    {PRODUCT_FORMATS.map(format => <option key={format.value} value={format.value}>{format.label}</option>)}
                  </select>
                </label>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Dodatkowe wskazówki</label>
              <Textarea
                value={extraNotes}
                onChange={(event) => setExtraNotes(event.target.value)}
                placeholder={productMode ? 'Np. ciepłe światło z lewej strony, minimalistyczna kompozycja, dużo wolnego miejsca wokół produktu...' : 'Np. tło ma być bardzo jasne, bardziej premium, bardziej naturalne, bez ludzi w tle...'}
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
                <Coins className="w-4 h-4" /> {productMode && seriesMode ? `Koszt za ${poseIds.length}: ` : 'Koszt: '}<span className="font-medium text-foreground">{isAdmin ? '∞' : `${totalCost} kr`}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Saldo: <span className="font-medium text-foreground">{isAdmin ? '∞' : creditsLoading ? '...' : `${balance ?? 0} kr`}</span>
              </p>
            </div>

            <Button
              onClick={replaceBackground}
              disabled={!selectedImage || loading || !selectedModelOption || creditsLoading || (productMode && !poseIds.length)}
              className="w-full gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {productMode
                ? (adMode ? 'Wygeneruj zdjęcie reklamowe' : seriesMode ? 'Wygeneruj wybrane ujęcia' : 'Wygeneruj zdjęcie produktowe')
                : (loading ? 'Podmieniam tło...' : 'Podmień tło')}
            </Button>
            {productMode && loading && <p role="status" className="text-sm text-muted-foreground">Tworzę ujęcie {shotProgress} z {poseIds.length}. Zostań na tej stronie do końca generowania.</p>}
            {seriesError && <p role="alert" className="text-sm text-destructive">{seriesError}</p>}

            {resultImage && (
              <div className="space-y-4">
                <div className="rounded-xl border overflow-hidden bg-muted/20">
                  <img src={resultImage} alt={productMode ? 'Gotowe zdjęcie produktowe' : 'Wynik podmiany tła'} className="w-full max-h-[420px] object-contain" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void downloadResult(resultImage, `background-replace-${Date.now()}`)} variant="outline" className="gap-2">
                    <Download className="w-4 h-4" /> Pobierz wynik
                  </Button>
                  <Button onClick={() => setResultImage(null)} variant="outline">
                    Spróbuj ponownie
                  </Button>
                </div>
              </div>
            )}
            </fieldset>
            {productMode && productResults.length > 0 && (
              <section aria-label="Gotowe ujęcia" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Gotowe ujęcia</h2>
                  {productResults.length > 1 && <Button variant="outline" disabled={loading || packing} onClick={downloadSeries}>
                    {packing ? 'Przygotowuję ZIP…' : 'Pobierz serię ZIP'}
                  </Button>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {productResults.map(({ pose, url }, index) => (
                    <figure key={index} className="overflow-hidden rounded-xl border bg-muted/20">
                      <img src={url} alt={productResults.length === 1 ? 'Gotowe zdjęcie produktowe' : `Zdjęcie produktowe: ${pose.label}`} className="h-64 w-full object-contain" />
                      <figcaption className="flex flex-wrap items-center justify-between gap-2 p-3">
                        <span className="text-sm font-medium">{pose.label}</span>
                        <Button variant="outline" aria-label={`Pobierz ujęcie ${index + 1}: ${pose.label}`} onClick={() => void downloadResult(url, `zdjecie-produktowe-${index + 1}-${pose.id}`)}>
                          <Download className="mr-2 h-4 w-4" /> Pobierz
                        </Button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default BackgroundReplace;
