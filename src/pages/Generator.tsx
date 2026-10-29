import { useCallback, useEffect, useRef, useState } from 'react';
import { vpsFetch } from '@/lib/vpsApi';
import { getGeneratorHandoffStorage, hasAdArtDirection } from '@/lib/adGeneratorHandoff';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAiModels } from '@/hooks/useAiModels';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Download, RefreshCw, Loader2, Sparkles, Upload, X, Coins, Mic, MicOff } from 'lucide-react';
import { Link } from 'react-router-dom';

const DEFAULT_MAX_REFERENCE_IMAGES = 5;
const ADMIN_MAX_REFERENCE_IMAGES = 10;
const MAX_REFERENCE_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_REFERENCE_UPLOAD_EDGE = 1280;
const REFERENCE_UPLOAD_QUALITY = 0.82;
const SUPPORTED_REFERENCE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SUPPORTED_REFERENCE_FORMATS_LABEL = 'JPG, PNG albo WebP';
const generationCountOptions = [1, 2, 3, 4];
const MAX_PARALLEL_GENERATION_JOBS = 3;

type GenerationJobStatus = 'uploading' | 'generating' | 'saving' | 'completed' | 'failed';

type GenerationJob = {
  id: string;
  prompt: string;
  modelLabel: string;
  formatLabel: string;
  referenceCount: number;
  imageCount: number;
  cost: number;
  status: GenerationJobStatus;
  statusText: string;
  imageUrls: string[];
  error?: string;
  startedAt: number;
};

function createJobId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('FILE_READ_FAILED'));
    };
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };
    image.src = imageUrl;
  });
}

async function prepareReferenceDataUrl(file: File): Promise<string> {
  let image: HTMLImageElement;
  try {
    image = await loadImageElement(file);
  } catch {
    if (!SUPPORTED_REFERENCE_MIME_TYPES.has(file.type)) {
      throw new Error('UNSUPPORTED_REFERENCE_IMAGE_TYPE');
    }

    return readFileAsDataUrl(file);
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    return readFileAsDataUrl(file);
  }

  const scale = Math.min(1, MAX_REFERENCE_UPLOAD_EDGE / Math.max(sourceWidth, sourceHeight));
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    return readFileAsDataUrl(file);
  }

  try {
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const webpDataUrl = canvas.toDataURL('image/webp', REFERENCE_UPLOAD_QUALITY);
    if (webpDataUrl.startsWith('data:image/webp')) {
      return webpDataUrl;
    }

    return canvas.toDataURL(file.type || 'image/png', REFERENCE_UPLOAD_QUALITY);
  } catch {
    return readFileAsDataUrl(file);
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;
  if (error.message === 'UNSUPPORTED_REFERENCE_IMAGE_TYPE') {
    return `Ten format zdjęcia nie jest obsługiwany jako referencja. Wgraj ${SUPPORTED_REFERENCE_FORMATS_LABEL}.`;
  }
  return error.message;
}

function getGenerationLabel(count: number, hasReference: boolean): string {
  if (count === 1) {
    return hasReference ? 'Generuj z referencj\u0105' : 'Generuj grafik\u0119';
  }

  return `Generuj ${count} grafiki`;
}

function getModelBadge(modelId: string): string | null {
  if (modelId === 'gemini-25-image-economy') return 'tani';
  if (modelId === 'gemini-25-flash-image') return 'szybki';
  if (modelId === 'openai-gpt-image-2') return 'pro';
  if (modelId === 'gemini-3-pro-image') return 'premium';
  return null;
}

function getModelDescription(modelId: string): string {
  if (modelId === 'openai-gpt-image-2.5-flare') {
    return 'Szybkie generowanie i edycja grafik, także na podstawie zdjęć referencyjnych.';
  }
  if (modelId === 'openai-gpt-image-2.5-sunburst') {
    return 'Generowanie i precyzyjna edycja grafik z naciskiem na szczegóły i zgodność z referencją.';
  }
  if (modelId === 'gemini-25-image-economy') {
    return 'Najtańszy: szybkie szkice i wiele wariantów. Słabszy przy dużej liczbie napisów — lepiej używać krótkich tekstów.';
  }
  if (modelId === 'gemini-25-flash-image') {
    return 'Uniwersalny: reklamy, social media i proste napisy. Dobry kompromis, ale przy długich tekstach mogą pojawić się literówki.';
  }
  if (modelId === 'openai-gpt-image-2') {
    return 'Najlepszy do napisów: zwykle najlepiej trzyma krótkie teksty, układ typografii i czytelność. Wybieraj do ulotek, brandbooków i grafik z copy.';
  }
  if (modelId === 'gemini-3-pro-image') {
    return 'Najmocniejszy do złożonych układów premium. Dobry przy kompozycji, ale do perfekcyjnych napisów nadal bezpieczniejszy jest Studio Pro.';
  }
  return 'Model do generowania grafik AI. Przy ważnych napisach używaj krótkiego tekstu i sprawdź literówki po generacji.';
}

const styles = [
  { id: 'realistic', label: 'Realistyczny' },
  { id: 'illustration', label: 'Ilustracja' },
  { id: 'abstract', label: 'Abstrakcja' },
  { id: 'pixel-art', label: 'Pixel Art' },
  { id: 'watercolor', label: 'Akwarela' },
  { id: 'neon', label: 'Neon' },
];

const formats = [
  { id: '1:1', label: '1:1', dims: '1024x1024' },
  { id: '16:9', label: '16:9', dims: '1920x1080' },
  { id: 'banner-wide', label: 'Baner wide', dims: '1792x1024' },
  { id: 'business-card', label: 'Wizytówka', dims: '1536x1024' },
  { id: '9:16', label: '9:16', dims: '1080x1920' },
  { id: '2:3', label: '2:3', dims: '1024x1536' },
  { id: '4:5', label: '4:5', dims: '1080x1350' },
  { id: 'a4-poster', label: 'A4 / oferta', dims: '1024x1536' },
  { id: 'story', label: 'Story/Reels', dims: '1080x1920' },
  { id: 'linkedin-post', label: 'LinkedIn', dims: '1536x1024' },
];

const Generator = () => {
  const { user } = useAuth();
  const { balance, loading: creditsLoading, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const {
    aiModels,
    loading: modelsLoading,
    selectedModel,
    selectedModelOption,
    setSelectedModel,
  } = useAiModels({ purpose: 'generation' });

  const [prompt, setPrompt] = useState('');
  const handoffAppliedRef = useRef(false);
  const [style, setStyle] = useState('realistic');
  const [format, setFormat] = useState('1:1');
  const [imageCount, setImageCount] = useState(1);
  const [background, setBackground] = useState<'auto' | 'transparent' | 'opaque'>('auto');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [referencePreviews, setReferencePreviews] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [companyAssistantContext, setCompanyAssistantContext] = useState<Record<string, unknown> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const selectedFormat = formats.find((item) => item.id === format);
  const supportsTransparency = selectedModelOption?.provider === 'openai' && (selectedModelOption.apiModel || '').startsWith('gpt-image-');
  const selectedModelSupportsReferences = selectedModelOption?.supportsReferenceImages ?? false;
  const firstReferenceCapableModel =
    aiModels.find((model) => model.id === 'gemini-25-flash-image' && model.supportsReferenceImages) ??
    aiModels.find((model) => model.supportsReferenceImages);
  const maxImages = isAdmin ? ADMIN_MAX_REFERENCE_IMAGES : DEFAULT_MAX_REFERENCE_IMAGES;
  const currentModelCost = selectedModelOption?.cost ?? 50;
  const effectiveImageCount = referenceFiles.length === 1 ? 1 : imageCount;
  const totalGenerationCost = currentModelCost * effectiveImageCount;
  const primaryGeneratedImage = generatedImages[0] ?? null;
  const activeGenerationCount = generationJobs.filter((job) => !['completed', 'failed'].includes(job.status)).length;
  const canStartAnotherGeneration = activeGenerationCount < MAX_PARALLEL_GENERATION_JOBS;
  const companyContextLabel =
    companyAssistantContext && typeof companyAssistantContext === 'object'
      ? [
          typeof companyAssistantContext.companyName === 'string' && companyAssistantContext.companyName
            ? companyAssistantContext.companyName
            : 'Projekt firmowy',
          typeof companyAssistantContext.materialTitle === 'string' && companyAssistantContext.materialTitle
            ? companyAssistantContext.materialTitle
          : '',
        ].filter(Boolean).join(' · ')
      : '';
  const isBrandbookDocumentHandoff =
    companyAssistantContext &&
    typeof companyAssistantContext === 'object' &&
    (
      companyAssistantContext.materialId === 'brandbook' ||
      (typeof companyAssistantContext.materialTitle === 'string' && /brandbook/i.test(companyAssistantContext.materialTitle))
    );

  const updateGenerationJob = (jobId: string, patch: Partial<GenerationJob>) => {
    setGenerationJobs((current) => current.map((job) => (job.id === jobId ? { ...job, ...patch } : job)));
  };

  useEffect(() => {
    if (handoffAppliedRef.current) return;
    handoffAppliedRef.current = true;
    const handoffStorage = getGeneratorHandoffStorage(window.sessionStorage, window.localStorage);
    const getHandoffValue = (key: string) => handoffStorage.getItem(key);
    const clearHandoffValue = (key: string) => {
      handoffStorage.removeItem(key);
    };

    const companyAssistantPrompt = getHandoffValue('companyAssistantPrompt');
    if (companyAssistantPrompt) {
      const promptSource = getHandoffValue('companyAssistantPromptSource');
      setPrompt(companyAssistantPrompt);
      clearHandoffValue('companyAssistantPrompt');
      clearHandoffValue('companyAssistantPromptSource');

      const savedFormat = getHandoffValue('companyAssistantFormat');
      if (savedFormat && formats.some((item) => item.id === savedFormat)) {
        setFormat(savedFormat);
      }
      clearHandoffValue('companyAssistantFormat');

      const savedStyle = getHandoffValue('companyAssistantStyle');
      if (savedStyle && styles.some((item) => item.id === savedStyle)) {
        setStyle(savedStyle);
      }
      clearHandoffValue('companyAssistantStyle');

      const savedCompanyContext = getHandoffValue('companyAssistantContext');
      if (savedCompanyContext) {
        try {
          setCompanyAssistantContext(JSON.parse(savedCompanyContext));
        } catch {
          setCompanyAssistantContext(null);
        }
      }
      clearHandoffValue('companyAssistantContext');

      toast.success(promptSource === 'ad-generator'
        ? 'Prompt reklamowy został wstawiony — lista promptów czeka w poprzedniej karcie'
        : 'Prompt z Asystenta firmy został wstawiony');
      return;
    }

    clearHandoffValue('companyAssistantFormat');
    clearHandoffValue('companyAssistantStyle');
    clearHandoffValue('companyAssistantContext');
    clearHandoffValue('companyAssistantPromptSource');
    setCompanyAssistantContext(null);

    const savedPrompt = getHandoffValue('promptGeneratorProPrompt');
    if (!savedPrompt) return;

    setPrompt(savedPrompt);
    clearHandoffValue('promptGeneratorProPrompt');
    toast.success('Prompt z Generatora Promptów Pro został wstawiony');
  }, []);

  useEffect(() => {
    if (referenceFiles.length === 1 && imageCount !== 1) {
      setImageCount(1);
    }
  }, [imageCount, referenceFiles.length]);

  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Twoja przegl\u0105darka nie wspiera rozpoznawania mowy');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pl-PL';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          setPrompt((prev) => (prev ? `${prev} ${event.results[i][0].transcript}` : event.results[i][0].transcript));
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'aborted') {
        toast.error('B\u0142\u0105d rozpoznawania mowy');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (!selectedModelSupportsReferences) {
      if (!firstReferenceCapableModel) {
        toast.error('Brak aktywnego modelu obs\u0142uguj\u0105cego zdj\u0119cia referencyjne');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedModel(firstReferenceCapableModel.id);
      toast.info(`Prze\u0142\u0105czono na model ${firstReferenceCapableModel.label}, bo obs\u0142uguje zdj\u0119cia referencyjne`);
    }

    const remaining = maxImages - referenceFiles.length;
    if (remaining <= 0) {
      toast.error(`Mo\u017cesz doda\u0107 maksymalnie ${maxImages} zdj\u0119\u0107 referencyjnych`);
      return;
    }

    const toAdd = files.slice(0, remaining);
    for (const file of toAdd) {
      if (!file.type.startsWith('image/')) {
        toast.error('Wybierz plik graficzny');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (!SUPPORTED_REFERENCE_MIME_TYPES.has(file.type)) {
        toast.error(`Ten format zdjęcia nie jest obsługiwany jako referencja. Wgraj ${SUPPORTED_REFERENCE_FORMATS_LABEL}.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.size > MAX_REFERENCE_FILE_SIZE_BYTES) {
        toast.error('Plik jest za du\u017cy (max 20MB)');
        return;
      }
    }

    setReferenceFiles((prev) => [...prev, ...toAdd]);
    setReferencePreviews((prev) => [...prev, ...toAdd.map((file) => URL.createObjectURL(file))]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeReference = (index: number) => {
    URL.revokeObjectURL(referencePreviews[index]);
    setReferenceFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setReferencePreviews((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleModelSelect = (modelId: string) => {
    const nextModel = aiModels.find((model) => model.id === modelId);
    if (!nextModel) return;

    if (!nextModel.supportsReferenceImages && referenceFiles.length > 0) {
      toast.error('Ten model nie obs\u0142uguje zdj\u0119\u0107 referencyjnych. Usu\u0144 referencje albo wybierz inny model.');
      return;
    }

    if (background === 'transparent' && !(nextModel.provider === 'openai' && (nextModel.apiModel || '').startsWith('gpt-image-'))) {
      toast.error('PNG bez tła wymaga Sunburst, Flare lub Studio Ultra. Zmień najpierw ustawienie tła.');
      return;
    }
    setSelectedModel(modelId);
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Musisz by\u0107 zalogowany');
      return;
    }
    if (!selectedModel) {
      toast.error('Wybierz model AI');
      return;
    }
    if (!prompt.trim()) {
      toast.error('Wpisz opis grafiki');
      return;
    }
    if (referenceFiles.length > 0 && !selectedModelSupportsReferences) {
      toast.error('Wybrany model nie obs\u0142uguje zdj\u0119\u0107 referencyjnych');
      return;
    }
    if (!canStartAnotherGeneration) {
      toast.error(`Poczekaj chwilę — maksymalnie ${MAX_PARALLEL_GENERATION_JOBS} generacje naraz.`);
      return;
    }

    const jobId = createJobId();
    const promptSnapshot = prompt;
    const styleSnapshot = style;
    const backgroundSnapshot = background;
    const formatSnapshot = selectedFormat;
    const modelSnapshot = selectedModel;
    const modelLabelSnapshot = selectedModelOption?.label || selectedModel;
    const referenceFilesSnapshot = [...referenceFiles];
    const effectiveImageCountSnapshot = effectiveImageCount;
    const totalGenerationCostSnapshot = totalGenerationCost;
    const companyAssistantContextSnapshot = companyAssistantContext;

    setGenerationJobs((current) => [
      {
        id: jobId,
        prompt: promptSnapshot,
        modelLabel: modelLabelSnapshot,
        formatLabel: formatSnapshot?.label || format,
        referenceCount: referenceFilesSnapshot.length,
        imageCount: effectiveImageCountSnapshot,
        cost: totalGenerationCostSnapshot,
        status: referenceFilesSnapshot.length > 0 ? 'uploading' : 'generating',
        statusText: referenceFilesSnapshot.length > 0 ? 'Przygotowuję zdjęcia referencyjne...' : 'Model AI generuje grafikę...',
        imageUrls: [],
        startedAt: Date.now(),
      },
      ...current,
    ].slice(0, 12));
    setGenerationStatus(referenceFilesSnapshot.length > 0 ? 'Przygotowuję zdjęcia referencyjne...' : 'Przygotowuję generowanie...');

    try {
      const uploadReferenceFile = async (file: File) => {
        const dataUrl = await prepareReferenceDataUrl(file);
        const contentType = dataUrl.match(/^data:([^;]+);base64,/i)?.[1] || file.type;
        if (!SUPPORTED_REFERENCE_MIME_TYPES.has(contentType)) {
          throw new Error(`Nieobsługiwany format referencji. Wgraj ${SUPPORTED_REFERENCE_FORMATS_LABEL}.`);
        }

        const uploadData = await vpsFetch<{ ok: boolean; path: string; message?: string }>('/gallery/reference-upload', {
          method: 'POST',
          body: JSON.stringify({
            dataUrl,
            fileName: file.name,
          }),
        });

        if (!uploadData?.path) {
          throw new Error('Nie uda\u0142o si\u0119 przes\u0142a\u0107 zdj\u0119cia referencyjnego');
        }

        return uploadData.path;
      };

      let referenceImagePaths: string[] = [];
      if (referenceFilesSnapshot.length > 0) {
        const uploadStatus =
          referenceFilesSnapshot.length === 1
            ? 'Optymalizuję i wysyłam zdjęcie referencyjne...'
            : `Optymalizuję i wysyłam ${referenceFilesSnapshot.length} zdjęcia referencyjne...`;
        setGenerationStatus(uploadStatus);
        updateGenerationJob(jobId, { status: 'uploading', statusText: uploadStatus });
        referenceImagePaths = await Promise.all(referenceFilesSnapshot.map(uploadReferenceFile));
      }

      setGenerationStatus('Model AI generuje grafikę...');
      updateGenerationJob(jobId, { status: 'generating', statusText: 'Model AI generuje grafikę...' });

      const data = await vpsFetch<{ imageUrls?: string[]; imageUrl?: string; error?: string }>('/ai/generate-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: promptSnapshot,
          style: styleSnapshot,
          background: backgroundSnapshot,
          dimensions: formatSnapshot?.dims,
          referenceImagePaths,
          model: modelSnapshot,
          count: effectiveImageCountSnapshot,
          companyAssistantContext: companyAssistantContextSnapshot,
        }),
      });

      if (data?.error) {
        updateGenerationJob(jobId, { status: 'failed', statusText: 'Nie udało się wygenerować', error: data.error });
        toast.error(data.error);
        return;
      }

      const nextImages = Array.isArray(data?.imageUrls) && data.imageUrls.length > 0
        ? data.imageUrls
        : data?.imageUrl
          ? [data.imageUrl]
          : [];

      setGenerationStatus('Zapisuję wynik do galerii...');
      updateGenerationJob(jobId, { status: 'saving', statusText: 'Zapisuję wynik do galerii...' });
      setGeneratedImages(nextImages);
      refetchCredits();
      updateGenerationJob(jobId, {
        status: 'completed',
        statusText: nextImages.length > 1 ? `Gotowe: ${nextImages.length} grafiki` : 'Gotowe: grafika wygenerowana',
        imageUrls: nextImages,
      });
      toast.success(
        nextImages.length > 1
          ? `Wygenerowano ${nextImages.length} grafik i zapisano je do galerii!`
          : 'Grafika wygenerowana i zapisana do galerii!',
      );
    } catch (err) {
      console.error('Generate error:', err);
      const message = getErrorMessage(err, 'Nie uda\u0142o si\u0119 wygenerowa\u0107 grafiki');
      updateGenerationJob(jobId, { status: 'failed', statusText: 'Nie udało się wygenerować', error: message });
      toast.error(message);
    } finally {
      setGenerationStatus('');
    }
  };

  const handleDownload = async (imageUrl?: string, index = 0) => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `grafika-ai-${Date.now()}-${index + 1}.png`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error('Nie uda\u0142o si\u0119 pobra\u0107');
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            <Sparkles className="inline w-6 h-6 text-primary mr-2" />
            Generator grafik <span className="gradient-text">AI</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {'Opisz grafik\u0119, a AI j\u0105 stworzy. Mo\u017cesz doda\u0107 zdj\u0119cie referencyjne i wybra\u0107 liczb\u0119 wynik\u00f3w.'}
          </p>
          {companyContextLabel && (
            <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm text-primary">
              <Wand2 className="h-4 w-4 shrink-0" />
              <span className="truncate">Zapis do firmy: {companyContextLabel}</span>
            </div>
          )}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="relative">
              <Textarea
                placeholder={'Opisz grafik\u0119, kt\u00f3r\u0105 chcesz stworzy\u0107...'}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-[30vh] resize-none text-base pr-12"
              />
              <Button
                type="button"
                variant={isListening ? 'destructive' : 'outline'}
                size="icon"
                className="absolute top-2 right-2"
                onClick={toggleVoice}
                title={isListening ? 'Zatrzymaj dyktowanie' : 'Dyktuj g\u0142osem'}
              >
                {isListening ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
              </Button>
            </div>

            {isBrandbookDocumentHandoff && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
                <p className="font-semibold text-foreground">Mini brandbook to teraz dokument PDF, nie grafika AI.</p>
                <p className="mt-1 text-muted-foreground">
                  Nie pobieramy kredytów za generowanie obrazka. Otwórz panel firmy i pobierz brandbook jako PDF z logo, kolorami, typografią, briefem, promptami i zapisanymi assetami.
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-2">{`Zdj\u0119cia referencyjne (${referenceFiles.length}/${maxImages})`}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex flex-wrap gap-2 items-center">
                {referencePreviews.map((preview, index) => (
                  <div key={preview} className="relative inline-block">
                    <img
                      src={preview}
                      alt={`Referencja ${index + 1}`}
                      className="h-24 w-24 object-cover rounded-lg border border-border"
                    />
                    <button
                      onClick={() => removeReference(index)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {referenceFiles.length < maxImages && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    <Upload className="w-4 h-4" /> {'Dodaj zdj\u0119cie'}
                  </Button>
                )}
              </div>
              {referenceFiles.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {`AI wykorzysta ${referenceFiles.length > 1 ? 'zdj\u0119cia referencyjne' : 'zdj\u0119cie referencyjne'} zgodnie z opisem.`}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Model AI</p>
              <div className="flex flex-wrap gap-2">
                {modelsLoading ? (
                  <span className="text-xs text-muted-foreground">{'\u0141adowanie modeli...'}</span>
                ) : aiModels.length === 0 ? (
                  <span className="text-xs text-muted-foreground">{'Brak dost\u0119pnych modeli'}</span>
                ) : (
                  aiModels.map((model) => (
                    <Button
                      key={model.id}
                      variant={selectedModel === model.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleModelSelect(model.id)}
                      className={selectedModel === model.id ? 'gradient-bg' : ''}
                    >
                      {model.label}
                      {getModelBadge(model.id) && (
                        <span className="ml-1 rounded bg-background/20 px-1 py-0.5 text-[10px] leading-none">
                          {getModelBadge(model.id)}
                        </span>
                      )}
                      <span className="text-[10px] opacity-70 ml-1">({model.cost} kr)</span>
                    </Button>
                  ))
                )}
              </div>
              {selectedModelOption && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {getModelDescription(selectedModelOption.id)}
                </p>
              )}
              <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                Dokładne napisy: wybierz Studio Pro. Generator blokuje copy znak w znak i pilnuje polskich znaków, ale najlepszy wynik daje krótki nagłówek, maksymalnie 3 krótkie korzyści i jedno CTA.
              </p>
              {!modelsLoading && !selectedModelSupportsReferences && (
                <p className="text-xs text-amber-600 mt-2">
                  {'Ten model nie korzysta ze zdj\u0119\u0107 referencyjnych. Dodanie referencji prze\u0142\u0105czy model na zgodny.'}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Styl grafiki</p>
              {hasAdArtDirection(prompt) ? <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed">
                Styl, tło i efekty pochodzą z wybranej koncepcji reklamy. Aby je zmienić, edytuj opis sceny w prompcie powyżej lub wybierz inną propozycję w poprzedniej karcie.
              </p> : <div className="flex flex-wrap gap-2">
                {styles.map((item) => (
                  <Button
                    key={item.id}
                    variant={style === item.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStyle(item.id)}
                    className={style === item.id ? 'gradient-bg' : ''}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Format grafiki</p>
              <div className="flex flex-wrap gap-2">
                {formats.map((item) => (
                  <Button
                    key={item.id}
                    variant={format === item.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormat(item.id)}
                    className={format === item.id ? 'gradient-bg' : ''}
                  >
                    {item.label}
                    <span className="text-[10px] opacity-70 ml-1">({item.dims})</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <label htmlFor="generation-background" className="text-sm font-medium">Tło grafiki · PNG</label>
              <select id="generation-background" value={background} onChange={event => setBackground(event.target.value as typeof background)} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                <option value="auto">Automatycznie z opisu</option>
                <option value="transparent" disabled={!supportsTransparency}>Przezroczyste · PNG bez tła</option>
                <option value="opaque">Pełne tło</option>
              </select>
              <p className="text-xs text-muted-foreground">{supportsTransparency ? 'Opis „bez tła” lub „transparent background” automatycznie włącza przezroczystość. Możesz też wybrać ją tutaj. Szachownica w podglądzie oznacza puste tło.' : 'Do PNG z przezroczystym tłem wybierz Sunburst, Flare lub Studio Ultra. Sam format PNG nie oznacza braku tła.'}</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">{'Ilo\u015b\u0107 grafik'}</p>
              <div className="flex flex-wrap gap-2">
                {generationCountOptions.map((countOption) => (
                  <Button
                    key={countOption}
                    variant={effectiveImageCount === countOption ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImageCount(countOption)}
                    disabled={referenceFiles.length === 1 && countOption !== 1}
                    className={effectiveImageCount === countOption ? 'gradient-bg' : ''}
                  >
                    {countOption}x
                  </Button>
                ))}
              </div>
              {referenceFiles.length === 1 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {'Jedno zdjęcie referencyjne generuje obecnie 1 wynik.'}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Coins className="w-4 h-4" />
                  Saldo:{' '}
                  <span className="font-medium text-primary">
                    {isAdmin ? '\u221e (admin)' : creditsLoading ? '...' : balance?.toLocaleString('pl-PL')}
                  </span>{' '}
                  {!isAdmin && 'kr'}
                </span>
                <span>{'\u2022'}</span>
                <span>
                  {isBrandbookDocumentHandoff ? (
                    <>
                      PDF: <span className="font-medium">bez kredytów</span>
                    </>
                  ) : (
                    <>
                      Koszt: <span className="font-medium">{totalGenerationCost}</span> kr
                    </>
                  )}
                </span>
              </div>
              <Link to="/credits">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  <Coins className="w-3 h-3" /> Kup kredyty
                </Button>
              </Link>
            </div>

            {isBrandbookDocumentHandoff ? (
              <Button asChild className="w-full gradient-bg hover:opacity-90 transition-opacity" size="lg">
                <Link to="/profile">
                  <Download className="w-4 h-4" />
                  Generuj / pobierz brandbook PDF
                </Link>
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!canStartAnotherGeneration || !prompt.trim() || (!isAdmin && (balance ?? 0) < totalGenerationCost)}
                className="w-full gradient-bg hover:opacity-90 transition-opacity"
                size="lg"
              >
                {!isAdmin && (balance ?? 0) < totalGenerationCost ? (
                  'Brak kredyt\u00f3w'
                ) : !canStartAnotherGeneration ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Limit równoległych generacji...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    {getGenerationLabel(effectiveImageCount, referenceFiles.length > 0)} ({totalGenerationCost} kr)
                  </>
                )}
              </Button>
            )}
            {activeGenerationCount > 0 && generationStatus && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>
                    {activeGenerationCount === 1
                      ? generationStatus
                      : `Trwa ${activeGenerationCount} generacji równolegle...`}
                  </span>
                </div>
                {referenceFiles.length > 0 && (
                  <p className="mt-1 text-xs">
                    Referencje są automatycznie zmniejszane do max 1280 px i WebP, żeby szybciej przejść do modelu AI.
                  </p>
                )}
              </div>
            )}
            {generationJobs.length > 0 && (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">Zadania generowania</p>
                    <p className="text-xs text-muted-foreground">
                      Możesz uruchomić do {MAX_PARALLEL_GENERATION_JOBS} generacji naraz. Każde zadanie zapisuje wynik osobno w galerii.
                    </p>
                  </div>
                  {activeGenerationCount > 0 && (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      Aktywne: {activeGenerationCount}
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {generationJobs.map((job) => {
                    const isActive = !['completed', 'failed'].includes(job.status);
                    return (
                      <div key={job.id} className="rounded-xl border bg-background p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{job.modelLabel}</p>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                {job.formatLabel}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                {job.imageCount}x · {job.cost} kr
                              </span>
                              {job.referenceCount > 0 && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                  ref: {job.referenceCount}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{job.prompt}</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {isActive && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                            <span className={job.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>
                              {job.error || job.statusText}
                            </span>
                          </div>
                        </div>
                        {job.imageUrls.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {job.imageUrls.map((imageUrl, index) => (
                              <div key={`${job.id}-${imageUrl}-${index}`} className="space-y-2">
                                <img src={imageUrl} alt={`${job.prompt} ${index + 1}`} className="aspect-square w-full rounded-lg border object-contain bg-[repeating-conic-gradient(#eee_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]" />
                                <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => handleDownload(imageUrl, index)}>
                                  <Download className="h-3.5 w-3.5" /> Pobierz
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <AnimatePresence>
          {primaryGeneratedImage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className={`grid gap-4 ${generatedImages.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                    {generatedImages.map((imageUrl, index) => (
                      <div key={`${imageUrl}-${index}`} className="space-y-3">
                        <div className="relative overflow-hidden rounded-lg border border-border bg-[repeating-conic-gradient(#eee_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
                          <img src={imageUrl} alt={`${prompt} ${index + 1}`} className="w-full" />
                        </div>
                        <Button onClick={() => handleDownload(imageUrl, index)} variant="outline" className="gap-1.5 w-full">
                          <Download className="w-4 h-4" /> {generatedImages.length > 1 ? `Pobierz #${index + 1}` : 'Pobierz'}
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleGenerate}
                    variant="outline"
                    disabled={!canStartAnotherGeneration || (!isAdmin && (balance ?? 0) < totalGenerationCost)}
                    className="gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" /> Generuj ponownie
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AppLayout>
  );
};

export default Generator;

