import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeCheck,
  Coins,
  Download,
  Eraser,
  Image,
  Loader2,
  Paintbrush,
  Search,
  Scissors,
  Type,
  Undo2,
  Upload,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useAiModels } from '@/hooks/useAiModels';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { BADGE_CATALOG, type BadgeCatalogItem } from '@/lib/badgeCatalog';
import { getTrimmedGraphicsMessage, saveGraphicToGallery } from '@/lib/graphicsLimit';
import { loadImageFromUrlAsDataUrl, loadUserGalleryImages, readImageFile } from '@/lib/toolImage';
import { vpsFetch } from '@/lib/vpsApi';

type GalleryImage = {
  id: string;
  url: string;
  prompt: string;
};

type EditorProps = {
  mode?: 'general' | 'badge';
};

type BadgeEditAction = 'replace-text' | 'change-color' | 'remove-element' | 'custom';

type BadgeEditorLibraryResponse = {
  badges?: BadgeCatalogItem[];
  hiddenKeys?: string[];
  access?: Array<{ badge_key: string; package_id: string }>;
  purchasedPackageIds?: string[];
};

const Editor = ({ mode = 'general' }: EditorProps) => {
  const isBadgeEditor = mode === 'badge';
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { balance, loading: creditsLoading, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const {
    aiModels,
    loading: modelsLoading,
    selectedModel,
    selectedModelOption,
    setSelectedModel,
  } = useAiModels({ purpose: 'editing' });

  const [prompt, setPrompt] = useState('');
  const [badgeEditAction, setBadgeEditAction] = useState<BadgeEditAction>('replace-text');
  const [oldText, setOldText] = useState('');
  const [newText, setNewText] = useState('');
  const [colorTarget, setColorTarget] = useState('');
  const [targetColor, setTargetColor] = useState('');
  const [elementToRemove, setElementToRemove] = useState('');
  const [badgeSearch, setBadgeSearch] = useState('');
  const [availableBadges, setAvailableBadges] = useState<BadgeCatalogItem[]>(isBadgeEditor ? [] : BADGE_CATALOG);
  const [badgeCatalogLoading, setBadgeCatalogLoading] = useState(isBadgeEditor);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceBase64, setSourceBase64] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState('image/png');
  const [sourceGraphicId, setSourceGraphicId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const badgePrefillAttemptedRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastDrawPoint = useRef<{ x: number; y: number } | null>(null);

  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [maskHistory, setMaskHistory] = useState<ImageData[]>([]);

  const [bgRemoveMode, setBgRemoveMode] = useState<'idle' | 'choosing' | 'processing'>('idle');

  const modelCost = selectedModelOption?.cost ?? 50;
  const currentModelCost = modelCost;

  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const normalizedBadgeSearch = badgeSearch.trim().toLowerCase();
  const matchingBadges = availableBadges.filter((badge) => (
    !normalizedBadgeSearch
    || badge.name.toLowerCase().includes(normalizedBadgeSearch)
    || badge.description.toLowerCase().includes(normalizedBadgeSearch)
    || badge.category.toLowerCase().includes(normalizedBadgeSearch)
  ));
  const hasEditDescription = isBadgeEditor
    ? badgeEditAction === 'replace-text'
      ? Boolean(oldText.trim() && newText.trim())
      : badgeEditAction === 'change-color'
        ? Boolean(colorTarget.trim() && targetColor.trim())
        : badgeEditAction === 'remove-element'
          ? Boolean(elementToRemove.trim())
          : Boolean(prompt.trim())
    : Boolean(prompt.trim());

  const resetEditor = useCallback(() => {
    setSourceImage(null);
    setSourceBase64(null);
    setSourceMime('image/png');
    setSourceGraphicId(null);
    setSourceLabel(null);
    setResultImage(null);
    setHasMask(false);
    setMaskHistory([]);
    setShowGallery(false);
  }, []);

  const applySourceDataUrl = useCallback((dataUrl: string, mimeType: string, graphicId?: string | null) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSourceImage(img);
      setSourceBase64(dataUrl.split(',')[1] || '');
      setSourceMime(mimeType);
      setSourceGraphicId(graphicId ?? null);
      setShowGallery(false);
      setResultImage(null);
      setHasMask(false);
      setMaskHistory([]);
    };
    img.onerror = () => toast.error('Nie udalo sie zaladowac obrazu');
    img.src = dataUrl;
  }, []);

  const loadGallery = useCallback(async () => {
    if (!user) return;

    try {
      const images = await loadUserGalleryImages(null, user.id, 20);
      setGalleryImages(images);
      setShowGallery(true);
    } catch (error) {
      console.error(error);
      toast.error('Nie udalo sie zaladowac galerii');
    }
  }, [user]);

  const loadImageFromUrl = useCallback(async (url: string, graphicId?: string, label?: string) => {
    try {
      const image = await loadImageFromUrlAsDataUrl(url);
      setSourceLabel(label ?? null);
      applySourceDataUrl(image.dataUrl, image.mimeType, graphicId ?? null);
    } catch (error) {
      console.error(error);
      toast.error('Nie udalo sie zaladowac obrazu');
    }
  }, [applySourceDataUrl]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const image = await readImageFile(file, 20);
      setSourceLabel(file.name);
      applySourceDataUrl(image.dataUrl, image.mimeType, null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udalo sie odczytac pliku');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!isBadgeEditor || !user) return;

    let cancelled = false;
    const loadBadgeCatalog = async () => {
      try {
        const data = await vpsFetch<BadgeEditorLibraryResponse>('/assets/badges/library');
        if (cancelled) return;

        const hiddenKeys = new Set(data.hiddenKeys || []);
        const purchasedPackageIds = new Set(data.purchasedPackageIds || []);
        const access = data.access || [];
        const allBadges = [
          ...BADGE_CATALOG.filter((badge) => !hiddenKeys.has(badge.id)),
          ...(data.badges || []),
        ];
        const unlockedBadges = allBadges.filter((badge) => {
          const restrictions = access.filter((entry) => entry.badge_key === badge.id);
          return restrictions.length === 0
            || restrictions.some((entry) => purchasedPackageIds.has(entry.package_id));
        });

        setAvailableBadges(unlockedBadges);
      } catch (error) {
        console.error(error);
        toast.error('Nie udało się pobrać bazy badge’ów. Nadal możesz wgrać własny plik.');
      } finally {
        if (!cancelled) setBadgeCatalogLoading(false);
      }
    };

    void loadBadgeCatalog();
    return () => { cancelled = true; };
  }, [isBadgeEditor, user]);

  useEffect(() => {
    if (!isBadgeEditor || badgeCatalogLoading || sourceImage || badgePrefillAttemptedRef.current) return;

    const requestedBadgeId = searchParams.get('badge');
    if (!requestedBadgeId) return;

    const requestedBadge = availableBadges.find((badge) => badge.id === requestedBadgeId);
    badgePrefillAttemptedRef.current = true;
    if (!requestedBadge) {
      toast.error('Ten badge jest niedostępny lub został ukryty.');
      return;
    }

    // The query parameter is an external navigation input that intentionally initializes the editor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadImageFromUrl(requestedBadge.src, undefined, requestedBadge.name);
  }, [availableBadges, badgeCatalogLoading, isBadgeEditor, loadImageFromUrl, searchParams, sourceImage]);

  useEffect(() => {
    if (!sourceImage || !canvasRef.current || !maskCanvasRef.current) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const container = containerRef.current;
    if (!container) return;

    const maxWidth = container.clientWidth;
    const ratio = sourceImage.naturalWidth / sourceImage.naturalHeight;
    const displayWidth = Math.min(maxWidth, sourceImage.naturalWidth);
    const displayHeight = displayWidth / ratio;

    canvas.width = displayWidth;
    canvas.height = displayHeight;
    maskCanvas.width = displayWidth;
    maskCanvas.height = displayHeight;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(sourceImage, 0, 0, displayWidth, displayHeight);
  }, [sourceImage]);

  const getPos = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = maskCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const pointer = 'touches' in event ? event.touches[0] : event;
    return {
      x: (pointer.clientX - rect.left) * canvas.width / rect.width,
      y: (pointer.clientY - rect.top) * canvas.height / rect.height,
    };
  };

  const startDraw = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (editing) return;
    const maskContext = maskCanvasRef.current?.getContext('2d');
    if (!maskContext || !maskCanvasRef.current) return;

    const snapshot = maskContext.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    setMaskHistory((prev) => [
      ...prev.slice(-10),
      snapshot,
    ]);

    setIsDrawing(true);
    const { x, y } = getPos(event);
    lastDrawPoint.current = { x, y };
    const scale = maskCanvasRef.current.width / maskCanvasRef.current.getBoundingClientRect().width;
    maskContext.beginPath();
    maskContext.arc(x, y, brushSize * scale / 2, 0, Math.PI * 2);
    maskContext.fillStyle = 'rgba(255, 0, 0, 0.4)';
    maskContext.fill();
    setHasMask(true);
  };

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (!isDrawing || editing) return;

    const maskContext = maskCanvasRef.current?.getContext('2d');
    if (!maskContext) return;

    const { x, y } = getPos(event);
    const previous = lastDrawPoint.current ?? { x, y };
    const canvas = maskCanvasRef.current!;
    maskContext.beginPath();
    maskContext.moveTo(previous.x, previous.y);
    maskContext.lineTo(x, y);
    maskContext.lineWidth = brushSize * canvas.width / canvas.getBoundingClientRect().width;
    maskContext.lineCap = 'round';
    maskContext.strokeStyle = 'rgba(255, 0, 0, 0.4)';
    maskContext.stroke();
    lastDrawPoint.current = { x, y };
  };

  const stopDraw = () => {
    setIsDrawing(false);
    lastDrawPoint.current = null;
  };

  const clearMask = () => {
    const maskContext = maskCanvasRef.current?.getContext('2d');
    if (!maskContext || !maskCanvasRef.current) return;

    maskContext.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    setHasMask(false);
    setMaskHistory([]);
  };

  const undoMask = () => {
    const maskContext = maskCanvasRef.current?.getContext('2d');
    if (!maskContext || !maskCanvasRef.current || maskHistory.length === 0) return;

    const previous = maskHistory[maskHistory.length - 1];
    maskContext.putImageData(previous, 0, 0);
    setHasMask(previous.data.some((value, index) => index % 4 === 3 && value > 10));
    setMaskHistory((history) => history.slice(0, -1));
  };

  const getMaskBase64 = (): string | null => {
    if (!maskCanvasRef.current || !hasMask) return null;

    const maskCanvas = maskCanvasRef.current;
    const context = maskCanvas.getContext('2d');
    if (!context) return null;

    const imageData = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = maskCanvas.width;
    outputCanvas.height = maskCanvas.height;

    const outputContext = outputCanvas.getContext('2d');
    if (!outputContext) return null;

    outputContext.fillStyle = 'white';
    outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

    const outputData = outputContext.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    for (let index = 0; index < imageData.data.length; index += 4) {
      if (imageData.data[index + 3] > 10) {
        outputData.data[index] = 255;
        outputData.data[index + 1] = 0;
        outputData.data[index + 2] = 0;
        outputData.data[index + 3] = 255;
      }
    }

    outputContext.putImageData(outputData, 0, 0);
    return outputCanvas.toDataURL('image/png').split(',')[1];
  };

  const getBadgeEditInstruction = () => {
    if (badgeEditAction === 'replace-text') {
      if (!oldText.trim() || !newText.trim()) return '';
      return [
        `Replace only the exact visible text "${oldText.trim()}" with "${newText.trim()}" inside the marked area.`,
        `The final text must be spelled exactly as: "${newText.trim()}".`,
        'Preserve the original font style, size, alignment, perspective, material, lighting, shadows, colors and the transparent background.',
        'Do not change anything outside the marked area.',
      ].join(' ');
    }

    if (badgeEditAction === 'remove-element') {
      if (!elementToRemove.trim()) return '';
      return [
        `Remove ${elementToRemove.trim()} from the marked area.`,
        'Reconstruct the underlying badge surface naturally, matching the nearby texture, color, lighting and shadows.',
        'Keep the transparent background and do not change anything outside the marked area.',
      ].join(' ');
    }

    if (badgeEditAction === 'change-color') {
      return colorTarget.trim() && targetColor.trim()
        ? `Change only the color of ${colorTarget.trim()} to ${targetColor.trim()}. Keep all lettering, texture, shapes and the original illustration style unchanged.`
        : '';
    }

    return prompt.trim();
  };

  const handleEdit = async () => {
    const editInstruction = isBadgeEditor ? getBadgeEditInstruction() : prompt.trim();

    if (!editInstruction) {
      toast.error(isBadgeEditor ? 'Uzupełnij dane zmiany' : 'Wpisz co chcesz zmienić');
      return;
    }

    if (!sourceBase64) {
      toast.error('Najpierw wybierz obraz');
      return;
    }

    if (isBadgeEditor && !hasMask) {
      toast.error('Zaznacz pędzlem tekst lub element, który chcesz zmienić');
      return;
    }

    setEditing(true);
    setResultImage(null);

    try {
      const maskBase64 = getMaskBase64();
      if (isBadgeEditor && !maskBase64) throw new Error('Zaznacz pędzlem napis lub element do zmiany.');

      const data = await vpsFetch<{ imageUrl?: string; error?: string }>('/ai/edit-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: editInstruction,
          imageBase64: sourceBase64,
          imageMimeType: sourceMime,
          maskBase64,
          badgeEdit: isBadgeEditor ? {
            action: badgeEditAction,
            oldText: oldText.trim(),
            newText: newText.trim(),
            target: badgeEditAction === 'change-color' ? colorTarget.trim() : elementToRemove.trim(),
            color: targetColor.trim(),
          } : undefined,
          model: selectedModel,
          parentGraphicId: sourceGraphicId,
        }),
      });

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResultImage(data.imageUrl ?? null);
      refetchCredits();
      toast.success(`${isBadgeEditor ? 'Badge' : 'Obraz'} edytowany i zapisany do galerii`);
    } catch (error) {
      console.error('Edit error:', error);
      toast.error(error instanceof Error ? error.message : 'Nie udało się edytować obrazu');
    } finally {
      setEditing(false);
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
      anchor.download = `${isBadgeEditor ? 'badge-edytowany' : 'edycja-ai'}-${Date.now()}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Nie udalo sie pobrac');
    }
  };

  const useResultAsSource = async () => {
    if (!resultImage) return;
    await loadImageFromUrl(resultImage, undefined, isBadgeEditor ? 'Poprzedni wynik' : undefined);
    setSourceGraphicId(null);
    setResultImage(null);
  };

  const saveResultToGallery = useCallback(async (dataUrl: string, savePrompt: string) => {
    if (!user) {
      toast.error('Musisz byc zalogowany');
      return false;
    }

    const { trimmedCount } = await saveGraphicToGallery({
      userId: user.id,
      dataUrl,
      prompt: savePrompt,
      style: 'realistic',
      type: 'edited',
    });

    const trimMessage = getTrimmedGraphicsMessage(trimmedCount);
    if (trimMessage) toast.info(trimMessage);

    return true;
  }, [user]);

  const handleBgRemoveFree = async () => {
    if (!sourceBase64 || !sourceImage) return;

    setBgRemoveMode('processing');

    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const dataUrl = `data:${sourceMime};base64,${sourceBase64}`;
      const blob = await removeBackground(dataUrl, {
        progress: (key, current, total) => {
          console.log(`BG removal progress: ${key} ${current}/${total}`);
        },
      });

      const resultDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Nie udalo sie odczytac wyniku'));
        reader.readAsDataURL(blob);
      });

      const saved = await saveResultToGallery(resultDataUrl, '[Usuniecie tla] Darmowe');
      if (!saved) return;

      setResultImage(resultDataUrl);
      toast.success('Tlo usuniete i zapisane do galerii');
    } catch (error) {
      console.error('BG removal error:', error);
      toast.error('Nie udalo sie usunac tla');
    } finally {
      setBgRemoveMode('idle');
    }
  };

  const handleBgRemoveAI = async () => {
    if (!sourceBase64) return;

    setBgRemoveMode('processing');

    try {
      const data = await vpsFetch<{ imageUrl?: string; error?: string }>('/ai/edit-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Remove the background completely, make it transparent. Keep only the main subject/object with clean edges.',
          imageBase64: sourceBase64,
          imageMimeType: sourceMime,
          model: selectedModel,
          parentGraphicId: sourceGraphicId,
        }),
      });

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResultImage(data.imageUrl ?? null);
      refetchCredits();
      toast.success('Tlo usuniete przez AI i zapisane do galerii');
    } catch (error) {
      console.error('AI BG removal error:', error);
      toast.error('Nie udalo sie usunac tla');
    } finally {
      setBgRemoveMode('idle');
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            {isBadgeEditor ? (
              <BadgeCheck className="inline w-6 h-6 text-primary mr-2" />
            ) : (
              <Paintbrush className="inline w-6 h-6 text-primary mr-2" />
            )}
            {isBadgeEditor ? 'Edytor badge’ów ' : 'Edytor grafik '}
            <span className="gradient-text">AI</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {isBadgeEditor
              ? 'Wybierz badge, zaznacz napis lub element i zleć AI precyzyjną zmianę.'
              : 'Zamaluj pędzlem obszar do zmiany, wpisz co chcesz zmienić, a AI zrobi resztę.'}
          </p>
        </div>

        {!sourceImage && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              {isBadgeEditor && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Wybierz badge z bazy</p>
                    <span className="text-xs text-muted-foreground">{matchingBadges.length} dostępnych</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={badgeSearch}
                      onChange={(event) => setBadgeSearch(event.target.value)}
                      placeholder="Szukaj badge’a..."
                      className="pl-9"
                    />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[30rem] overflow-y-auto p-2 border rounded-lg">
                    {badgeCatalogLoading ? (
                      <div className="col-span-full flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> Ładowanie bazy badge’ów...
                      </div>
                    ) : matchingBadges.length === 0 ? (
                      <p className="col-span-full text-center py-10 text-sm text-muted-foreground">Brak pasujących badge’ów</p>
                    ) : (
                      matchingBadges.map((badge) => (
                        <button
                          type="button"
                          key={badge.id}
                          onClick={() => loadImageFromUrl(badge.src, undefined, badge.name)}
                          className="group rounded-md border border-border p-2 hover:border-primary hover:bg-primary/5 transition-colors text-left"
                        >
                          <div className="aspect-square rounded bg-muted/40 flex items-center justify-center p-1 overflow-hidden">
                            <img src={badge.src} alt={badge.name} loading="lazy" className="max-w-full max-h-full object-contain" />
                          </div>
                          <p className="mt-1.5 text-[11px] font-medium leading-tight line-clamp-2 group-hover:text-primary">{badge.name}</p>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    albo użyj własnej grafiki
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </div>
              )}

              <p className="text-sm font-medium">{isBadgeEditor ? 'Własny badge' : 'Wybierz obraz do edycji'}</p>
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
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
                  {galleryImages.length === 0 ? (
                    <p className="col-span-full text-center text-muted-foreground text-sm py-4">Brak grafik w galerii</p>
                  ) : (
                    galleryImages.map((graphic) => (
                      <button
                        key={graphic.id}
                        onClick={() => loadImageFromUrl(graphic.url, graphic.id)}
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

        {sourceImage && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {isBadgeEditor ? 'Zaznacz napis lub element do zmiany' : 'Zamaluj obszar do zmiany (opcjonalnie)'}
                  </p>
                  {sourceLabel && <p className="text-xs text-muted-foreground mt-0.5">Wybrano: {sourceLabel}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={resetEditor} disabled={editing}>
                  Zmień obraz
                </Button>
              </div>

              {isBadgeEditor && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                  Zaznacz tylko napis albo fragment do zmiany, z małym marginesem. Poza zaznaczeniem zachowamy oryginalne piksele. Styl wewnątrz zaznaczenia AI dopasuje do oryginału.
                </div>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Paintbrush className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground w-20">Rozmiar: {brushSize}px</span>
                  <Slider
                    value={[brushSize]}
                    onValueChange={([value]) => setBrushSize(value)}
                    min={5}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={undoMask} disabled={editing || maskHistory.length === 0} className="gap-1">
                    <Undo2 className="w-3.5 h-3.5" /> Cofnij
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearMask} disabled={editing || !hasMask} className="gap-1">
                    <Eraser className="w-3.5 h-3.5" /> Wyczysc
                  </Button>
                  {!isBadgeEditor && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setBgRemoveMode('choosing')}
                      disabled={bgRemoveMode === 'processing'}
                      className="gap-1"
                    >
                      {bgRemoveMode === 'processing' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Scissors className="w-3.5 h-3.5" />
                      )}
                      Usuń tło
                    </Button>
                  )}
                </div>
              </div>

              <div
                ref={containerRef}
                className="relative border rounded-lg overflow-hidden bg-muted/30 select-none touch-none"
              >
                <canvas ref={canvasRef} className="block w-full" />
                <canvas
                  ref={maskCanvasRef}
                  aria-label="Zaznaczenie obszaru do edycji"
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ cursor: 'crosshair' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
              </div>

              {isBadgeEditor ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <Button
                      type="button"
                      variant={badgeEditAction === 'replace-text' ? 'default' : 'outline'}
                      onClick={() => setBadgeEditAction('replace-text')}
                      className="gap-1.5"
                    >
                      <Type className="w-4 h-4" /> Zmień napis
                    </Button>
                    <Button
                      type="button"
                      variant={badgeEditAction === 'change-color' ? 'default' : 'outline'}
                      onClick={() => setBadgeEditAction('change-color')}
                      className="gap-1.5"
                    >
                      <Paintbrush className="w-4 h-4" /> Zmień kolor
                    </Button>
                    <Button
                      type="button"
                      variant={badgeEditAction === 'remove-element' ? 'default' : 'outline'}
                      onClick={() => setBadgeEditAction('remove-element')}
                      className="gap-1.5"
                    >
                      <Eraser className="w-4 h-4" /> Usuń element
                    </Button>
                    <Button
                      type="button"
                      variant={badgeEditAction === 'custom' ? 'default' : 'outline'}
                      onClick={() => setBadgeEditAction('custom')}
                      className="gap-1.5"
                    >
                      <Paintbrush className="w-4 h-4" /> Własna zmiana
                    </Button>
                  </div>

                  {badgeEditAction === 'replace-text' && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="badge-old-text">Stary napis</label>
                        <Input
                          id="badge-old-text"
                          value={oldText}
                          onChange={(event) => setOldText(event.target.value)}
                          placeholder="np. BONUS DO KURSU"
                          maxLength={120}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="badge-new-text">Nowy napis</label>
                        <Input
                          id="badge-new-text"
                          value={newText}
                          onChange={(event) => setNewText(event.target.value)}
                          placeholder="np. PREZENT DLA CIEBIE"
                          maxLength={120}
                        />
                      </div>
                    </div>
                  )}

                  {badgeEditAction === 'change-color' && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="badge-color-target">Co przemalować?</label>
                        <Input id="badge-color-target" value={colorTarget} onChange={(event) => setColorTarget(event.target.value)} placeholder="np. czerwony nagłówek kalendarza" maxLength={180} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="badge-target-color">Nowy kolor</label>
                        <Input id="badge-target-color" value={targetColor} onChange={(event) => setTargetColor(event.target.value)} placeholder="np. granatowy lub #2048A0" maxLength={80} />
                      </div>
                    </div>
                  )}

                  {badgeEditAction === 'remove-element' && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="badge-remove-element">Co usunąć?</label>
                      <Input
                        id="badge-remove-element"
                        value={elementToRemove}
                        onChange={(event) => setElementToRemove(event.target.value)}
                        placeholder="np. ikonę PDF, kokardę albo cały napis"
                        maxLength={180}
                      />
                    </div>
                  )}

                  {badgeEditAction === 'custom' && (
                    <Textarea
                      placeholder="Opisz dokładnie zmianę w zaznaczonym obszarze..."
                      aria-label="Opis zmiany badge’a"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      className="min-h-[80px] resize-none"
                      maxLength={1000}
                    />
                  )}
                </div>
              ) : (
                <Textarea
                  placeholder="Opisz co chcesz zmienić w zaznaczonym obszarze... np. 'Zamień tło na plażę o zachodzie słońca'"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="min-h-[80px] resize-none"
                />
              )}

              <div>
                <p className="text-sm font-medium mb-2">Model AI</p>
                <div className="flex flex-wrap gap-2">
                  {modelsLoading ? (
                    <span className="text-xs text-muted-foreground">Ladowanie modeli...</span>
                  ) : aiModels.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Brak dostepnych modeli</span>
                  ) : (
                    aiModels.map((model) => (
                      <Button
                        key={model.id}
                        variant={selectedModel === model.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedModel(model.id)}
                        className={selectedModel === model.id ? 'gradient-bg' : ''}
                      >
                        {model.label}
                        <span className="text-[10px] opacity-70 ml-1">({model.cost} kr)</span>
                      </Button>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Coins className="w-4 h-4" />
                  Saldo:{' '}
                  <span className="font-medium text-primary">
                    {isAdmin ? '∞' : creditsLoading ? '...' : balance?.toLocaleString('pl-PL')}
                  </span>{' '}
                  {!isAdmin && 'kr'}
                  <span className="mx-1">•</span>
                  Koszt: <span className="font-medium">{currentModelCost}</span> kr
                </span>
                <Link to="/credits">
                  <Button variant="ghost" size="sm" className="text-xs gap-1">
                    <Coins className="w-3 h-3" /> Kup kredyty
                  </Button>
                </Link>
              </div>

              <Button
                onClick={handleEdit}
                disabled={
                  editing
                  || !hasEditDescription
                  || (isBadgeEditor && !hasMask)
                  || (!isAdmin && (balance ?? 0) < currentModelCost)
                }
                className="w-full gradient-bg hover:opacity-90 transition-opacity"
                size="lg"
              >
                {!isAdmin && (balance ?? 0) < currentModelCost ? (
                  'Brak kredytow'
                ) : editing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Edytowanie...
                  </>
                ) : (
                  <>
                    {isBadgeEditor ? <BadgeCheck className="w-4 h-4" /> : <Paintbrush className="w-4 h-4" />}
                    {isBadgeEditor
                      ? badgeEditAction === 'replace-text'
                        ? 'Zmień napis'
                        : badgeEditAction === 'remove-element'
                          ? 'Usuń element'
                          : badgeEditAction === 'change-color'
                            ? 'Zmień kolor'
                            : 'Edytuj badge'
                      : hasMask ? 'Edytuj zaznaczony obszar' : 'Edytuj cały obraz'}{' '}
                    ({currentModelCost} kr)
                  </>
                )}
              </Button>
              {isBadgeEditor && !hasMask && (
                <p className="text-xs text-center text-muted-foreground">Przycisk uaktywni się po zaznaczeniu obszaru pędzlem.</p>
              )}
            </CardContent>
          </Card>
        )}

        <AnimatePresence>
          {resultImage && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="overflow-hidden">
                <div className="relative">
                  <img src={resultImage} alt={sourceLabel || prompt || 'Wynik edycji AI'} className="w-full rounded-t-lg" />
                </div>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleDownload} variant="outline" className="gap-1.5">
                      <Download className="w-4 h-4" /> Pobierz
                    </Button>
                    <Button onClick={useResultAsSource} variant="outline" className="gap-1.5">
                      <Paintbrush className="w-4 h-4" /> Edytuj dalej
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Dialog open={bgRemoveMode === 'choosing'} onOpenChange={(open) => !open && setBgRemoveMode('idle')}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-primary" /> Usun tlo
              </DialogTitle>
              <DialogDescription>Wybierz metode usuwania tla z obrazu.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 mt-2">
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setBgRemoveMode('idle');
                  void handleBgRemoveFree();
                }}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Darmowe (w przegladarce)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Przetwarzanie lokalne - wolniejsze, nie zuzywa kredytow. Pierwsze uzycie pobiera model (~40MB).
                      </p>
                    </div>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap ml-2">0 kr</span>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer hover:border-primary transition-colors ${!isAdmin && (balance ?? 0) < currentModelCost ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => {
                  setBgRemoveMode('idle');
                  void handleBgRemoveAI();
                }}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">AI (lepsza jakosc)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Model AI - szybsze, lepsze krawedzie, zuzywa kredyty.
                      </p>
                    </div>
                    <span className="text-xs font-medium text-primary whitespace-nowrap ml-2">{currentModelCost} kr</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
};

export default Editor;
