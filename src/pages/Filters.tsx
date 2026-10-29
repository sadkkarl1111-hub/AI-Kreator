import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Palette, Download, Upload, Image, ArrowLeft, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTrimmedGraphicsMessage, saveGraphicToGallery } from '@/lib/graphicsLimit';
import { loadImageFromUrlAsDataUrl, loadUserGalleryImages, readImageFile } from '@/lib/toolImage';

const defaultFilters = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hueRotate: 0,
  blur: 0,
  sepia: 0,
  grayscale: 0,
};

const Filters = () => {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ id: string; url: string; prompt: string }[]>([]);

  const filterString = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) hue-rotate(${filters.hueRotate}deg) blur(${filters.blur}px) sepia(${filters.sepia}%) grayscale(${filters.grayscale}%)`;

  const applySourceImage = useCallback((dataUrl: string) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSourceImage(img);
      setShowGallery(false);
      setFilters(defaultFilters);
    };
    img.onerror = () => toast.error('Nie udalo sie zaladowac obrazu');
    img.src = dataUrl;
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
      applySourceImage(image.dataUrl);
    } catch {
      toast.error('Nie udalo sie zaladowac obrazu');
    }
  }, [applySourceImage]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const image = await readImageFile(file, 20);
      applySourceImage(image.dataUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udalo sie odczytac pliku');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!sourceImage || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const maxW = containerRef.current.clientWidth;
    const ratio = sourceImage.naturalWidth / sourceImage.naturalHeight;
    const displayW = Math.min(maxW, sourceImage.naturalWidth);
    const displayH = displayW / ratio;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = displayW;
    canvas.height = displayH;
    ctx.clearRect(0, 0, displayW, displayH);
    ctx.filter = filterString;
    ctx.drawImage(sourceImage, 0, 0, displayW, displayH);
    ctx.filter = 'none';
  }, [filterString, filters, sourceImage]);

  const exportCanvas = () => {
    if (!sourceImage) return null;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = sourceImage.naturalWidth;
    outCanvas.height = sourceImage.naturalHeight;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.filter = filterString;
    ctx.drawImage(sourceImage, 0, 0);
    ctx.filter = 'none';

    return outCanvas.toDataURL('image/png');
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Zaloguj sie');
      return;
    }

    const dataUrl = exportCanvas();
    if (!dataUrl) return;

    try {
      const { trimmedCount } = await saveGraphicToGallery({
        userId: user.id,
        dataUrl,
        prompt: '[Filtry] Korekta kolorow',
        style: 'realistic',
        type: 'edited',
      });
      const trimMessage = getTrimmedGraphicsMessage(trimmedCount);
      toast.success(trimMessage ? `Zapisano do galerii! ${trimMessage}` : 'Zapisano do galerii!');
    } catch {
      toast.error('Nie udalo sie zapisac');
    }
  };

  const handleDownload = () => {
    const dataUrl = exportCanvas();
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `filtry-${Date.now()}.png`;
    link.click();
  };

  const sliders = [
    { key: 'brightness' as const, label: 'Jasnosc', min: 0, max: 200, unit: '%' },
    { key: 'contrast' as const, label: 'Kontrast', min: 0, max: 200, unit: '%' },
    { key: 'saturate' as const, label: 'Nasycenie', min: 0, max: 300, unit: '%' },
    { key: 'hueRotate' as const, label: 'Odcien', min: 0, max: 360, unit: 'deg' },
    { key: 'sepia' as const, label: 'Sepia', min: 0, max: 100, unit: '%' },
    { key: 'grayscale' as const, label: 'Szarosci', min: 0, max: 100, unit: '%' },
    { key: 'blur' as const, label: 'Rozmycie', min: 0, max: 20, unit: 'px' },
  ];

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
              <Palette className="inline w-6 h-6 text-primary mr-2" />
              Filtry i <span className="gradient-text">korekty</span>
            </h1>
            <p className="text-muted-foreground mt-1">Reguluj jasnosc, kontrast i kolory bezposrednio na VPS.</p>
          </div>
        </div>

        {!sourceImage && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm font-medium">Wybierz obraz</p>
              <div className="flex flex-wrap gap-3">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" /> Wgraj z dysku
                </Button>
                {user ? (
                  <Button onClick={loadGallery} variant="outline" className="gap-2">
                    <Image className="w-4 h-4" /> Z galerii
                  </Button>
                ) : (
                  <Link to="/auth?returnTo=/tools/filters">
                    <Button variant="outline" className="gap-2">
                      <Image className="w-4 h-4" /> Galeria po logowaniu
                    </Button>
                  </Link>
                )}
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

        {sourceImage && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Podglad na zywo</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setFilters(defaultFilters)} className="gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSourceImage(null)}>
                    Zmien obraz
                  </Button>
                </div>
              </div>

              <div ref={containerRef} className="rounded-lg overflow-hidden border bg-muted/30">
                <canvas ref={canvasRef} className="block w-full" />
              </div>

              <div className="space-y-3">
                {sliders.map((slider) => (
                  <div key={slider.key} className="flex items-center gap-3">
                    <span className="text-xs w-28 shrink-0">{slider.label}</span>
                    <Slider
                      value={[filters[slider.key]]}
                      onValueChange={([value]) => setFilters((current) => ({ ...current, [slider.key]: value }))}
                      min={slider.min}
                      max={slider.max}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-14 text-right">
                      {filters[slider.key]}
                      {slider.unit}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {user ? (
                  <Button onClick={handleSave} className="gradient-bg gap-1.5">
                    <Palette className="w-4 h-4" /> Zapisz do galerii
                  </Button>
                ) : (
                  <Link to="/auth?returnTo=/tools/filters">
                    <Button variant="outline" className="gap-1.5">
                      <Palette className="w-4 h-4" /> Zapisz w galerii po logowaniu
                    </Button>
                  </Link>
                )}
                <Button onClick={handleDownload} variant="outline" className="gap-1.5">
                  <Download className="w-4 h-4" /> Pobierz
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default Filters;
