import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Image as ImageIcon, LayoutGrid, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  type GalleryToolImage,
  type SelectedToolImage,
  loadImageFromUrlAsDataUrl,
  loadUserGalleryImages,
  readImageFile,
} from '@/lib/toolImage';

type ResizePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  hint: string;
};

const SOCIAL_PRESETS: ResizePreset[] = [
  { id: 'instagram-post', label: 'Instagram Post', width: 1080, height: 1350, hint: 'Post w feedzie 4:5.' },
  { id: 'instagram-story', label: 'Instagram Story', width: 1080, height: 1920, hint: 'Relacje i stories.' },
  { id: 'facebook-post', label: 'Facebook Post', width: 1080, height: 1080, hint: 'Kwadrat 1:1 do posta.' },
  { id: 'facebook-cover', label: 'Facebook Cover', width: 851, height: 315, hint: 'Zdjęcie w tle strony.' },
  { id: 'linkedin-post', label: 'LinkedIn Post', width: 1200, height: 627, hint: 'Posty biznesowe.' },
  { id: 'youtube-thumb', label: 'YouTube Miniatura', width: 1280, height: 720, hint: 'Miniatura do YouTube.' },
  { id: 'pinterest-pin', label: 'Pinterest Pin', width: 1000, height: 1500, hint: 'Pionowy format pinów.' },
  { id: 'tiktok', label: 'TikTok / Reels', width: 1080, height: 1920, hint: 'Wideo pionowe i okładki.' },
];

type FitMode = 'cover' | 'contain';

const SocialResize = () => {
  const { user } = useAuth();
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [selectedImage, setSelectedImage] = useState<SelectedToolImage | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryToolImage[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [activePresetId, setActivePresetId] = useState<ResizePreset['id']>('instagram-post');
  const [fitMode, setFitMode] = useState<FitMode>('cover');
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');

  const activePreset = useMemo(
    () => SOCIAL_PRESETS.find((preset) => preset.id === activePresetId) ?? SOCIAL_PRESETS[0],
    [activePresetId],
  );
  const previewMaxWidth = 540;
  const previewMaxHeight = 520;
  const previewScale = useMemo(
    () => Math.min(previewMaxWidth / activePreset.width, previewMaxHeight / activePreset.height),
    [activePreset.height, activePreset.width],
  );
  const previewDisplayWidth = Math.round(activePreset.width * previewScale);

  const drawPresetToCanvas = useCallback((canvas: HTMLCanvasElement, preset: ResizePreset) => {
    const image = imageRef.current;
    if (!image) return;

    canvas.width = preset.width;
    canvas.height = preset.height;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const widthRatio = canvas.width / image.naturalWidth;
    const heightRatio = canvas.height / image.naturalHeight;
    const baseScale = fitMode === 'cover'
      ? Math.max(widthRatio, heightRatio)
      : Math.min(widthRatio, heightRatio);
    const finalScale = baseScale * zoom;

    const drawWidth = image.naturalWidth * finalScale;
    const drawHeight = image.naturalHeight * finalScale;
    const x = ((canvas.width - drawWidth) / 2) + ((offsetX / 100) * canvas.width * 0.35);
    const y = ((canvas.height - drawHeight) / 2) + ((offsetY / 100) * canvas.height * 0.35);

    context.drawImage(image, x, y, drawWidth, drawHeight);
  }, [backgroundColor, fitMode, offsetX, offsetY, zoom]);

  useEffect(() => {
    if (!selectedImage) {
      imageRef.current = null;
      return;
    }

    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      if (previewCanvasRef.current) {
        drawPresetToCanvas(previewCanvasRef.current, activePreset);
      }
    };
    image.onerror = () => {
      toast.error('Nie udało się załadować obrazu do resize');
    };
    image.src = selectedImage.dataUrl;
  }, [selectedImage, activePreset, drawPresetToCanvas]);

  useEffect(() => {
    if (!previewCanvasRef.current || !imageRef.current) return;
    drawPresetToCanvas(previewCanvasRef.current, activePreset);
  }, [activePreset, backgroundColor, drawPresetToCanvas, fitMode, offsetX, offsetY, zoom]);

  const handleFileUpload = async (file: File) => {
    try {
      const image = await readImageFile(file, 20);
      setSelectedImage(image);
      setShowGallery(false);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
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
      const image = await loadImageFromUrlAsDataUrl(url);
      setSelectedImage(image);
      setShowGallery(false);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się załadować obrazu z galerii');
    }
  };

  const downloadPreset = async (preset: ResizePreset) => {
    const image = imageRef.current;
    if (!image) return;

    const canvas = document.createElement('canvas');
    drawPresetToCanvas(canvas, preset);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${preset.id}-${Date.now()}.png`;
    link.click();
  };

  const downloadAllPresets = async () => {
    if (!imageRef.current) return;

    for (const preset of SOCIAL_PRESETS) {
      await downloadPreset(preset);
    }

    toast.success('Rozpoczęto pobieranie wszystkich formatów');
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-primary" /> Smart Resize Social
            </h1>
            <p className="text-sm text-muted-foreground">
              Jedno zdjęcie, kilka gotowych formatów pod social media i reklamy.
            </p>
          </div>
        </div>

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
                  {user ? (
                    <Button onClick={loadGallery} variant="outline" className="gap-2">
                      <ImageIcon className="w-4 h-4" /> Wybierz z galerii
                    </Button>
                  ) : (
                    <Link to="/auth?returnTo=/tools/social-resize">
                      <Button variant="outline" className="gap-2">
                        <ImageIcon className="w-4 h-4" /> Galeria po logowaniu
                      </Button>
                    </Link>
                  )}
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
              <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Format docelowy</p>
                    <div className="flex flex-wrap gap-2">
                      {SOCIAL_PRESETS.map((preset) => (
                        <Button
                          key={preset.id}
                          variant={activePresetId === preset.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setActivePresetId(preset.id)}
                          className={activePresetId === preset.id ? 'gradient-bg' : ''}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {activePreset.hint} {activePreset.width}×{activePreset.height}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Tryb dopasowania</p>
                    <div className="flex gap-2">
                      <Button
                        variant={fitMode === 'cover' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFitMode('cover')}
                        className={fitMode === 'cover' ? 'gradient-bg' : ''}
                      >
                        Wypełnij
                      </Button>
                      <Button
                        variant={fitMode === 'contain' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFitMode('contain')}
                        className={fitMode === 'contain' ? 'gradient-bg' : ''}
                      >
                        Dopasuj
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Powiększenie: {zoom.toFixed(2)}x</label>
                    <Slider value={[zoom]} min={0.5} max={2} step={0.01} onValueChange={([value]) => setZoom(value)} />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Przesunięcie poziome: {offsetX}</label>
                    <Slider value={[offsetX]} min={-100} max={100} step={1} onValueChange={([value]) => setOffsetX(value)} />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Przesunięcie pionowe: {offsetY}</label>
                    <Slider value={[offsetY]} min={-100} max={100} step={1} onValueChange={([value]) => setOffsetY(value)} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Kolor tła</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(event) => setBackgroundColor(event.target.value)}
                        className="h-10 w-14 cursor-pointer rounded border bg-transparent p-1"
                      />
                      <span className="text-sm text-muted-foreground">{backgroundColor.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setSelectedImage(null)}>
                      Zmień obraz
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setZoom(1);
                      setOffsetX(0);
                      setOffsetY(0);
                      setFitMode('cover');
                    }}>
                      Reset kadru
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border bg-muted/10 p-4">
                    <div className="flex justify-center">
                      <canvas
                        ref={previewCanvasRef}
                        className="w-full h-auto rounded-xl border bg-white shadow-sm"
                        style={{ maxWidth: `${previewDisplayWidth}px` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => downloadPreset(activePreset)} className="gap-2">
                      <Download className="w-4 h-4" /> Pobierz aktywny format
                    </Button>
                    <Button variant="outline" onClick={downloadAllPresets} className="gap-2">
                      <Download className="w-4 h-4" /> Pobierz wszystkie formaty
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Podgląd jest pomniejszony tylko w edytorze. Pobierane pliki zachowują pełne wymiary docelowe.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default SocialResize;
