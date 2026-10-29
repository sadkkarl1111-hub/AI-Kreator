import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Crop, Download, Upload, Image, ArrowLeft, RotateCw, FlipHorizontal, FlipVertical, Move } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTrimmedGraphicsMessage, saveGraphicToGallery } from '@/lib/graphicsLimit';
import { loadImageFromUrlAsDataUrl, loadUserGalleryImages, readImageFile } from '@/lib/toolImage';

const PRESETS = [
  { label: 'Dowolny', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '2:3', ratio: 2 / 3 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '5:4', ratio: 5 / 4 },
];

const CropTool = () => {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<number | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [cursor, setCursor] = useState('default');
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ id: string; url: string; prompt: string }[]>([]);

  const dragStartRef = useRef<{ mx: number; my: number; rect: { x: number; y: number; w: number; h: number } } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applySourceImage = useCallback((dataUrl: string) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSourceImage(img);
      setSourcePreview(dataUrl);
      setShowGallery(false);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setCropRect({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight });
      setSelectedRatio(null);
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

  const getScale = useCallback(() => {
    if (!sourceImage || !canvasRef.current) return { sx: 1, sy: 1 };
    return {
      sx: canvasRef.current.width / sourceImage.naturalWidth,
      sy: canvasRef.current.height / sourceImage.naturalHeight,
    };
  }, [sourceImage]);

  useEffect(() => {
    if (!sourceImage) return;

    if (selectedRatio === null) {
      setCropRect({ x: 0, y: 0, w: sourceImage.naturalWidth, h: sourceImage.naturalHeight });
      return;
    }

    const imgW = sourceImage.naturalWidth;
    const imgH = sourceImage.naturalHeight;
    let w = imgW;
    let h = imgW / selectedRatio;

    if (h > imgH) {
      h = imgH;
      w = imgH * selectedRatio;
    }

    setCropRect({
      x: (imgW - w) / 2,
      y: (imgH - h) / 2,
      w,
      h,
    });
  }, [selectedRatio, sourceImage]);

  useEffect(() => {
    if (!sourceImage || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const maxW = container.clientWidth;
    const ratio = sourceImage.naturalWidth / sourceImage.naturalHeight;
    const displayW = Math.min(maxW, sourceImage.naturalWidth);
    const displayH = displayW / ratio;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = displayW;
    canvas.height = displayH;

    ctx.clearRect(0, 0, displayW, displayH);
    ctx.save();
    ctx.translate(displayW / 2, displayH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(sourceImage, -displayW / 2, -displayH / 2, displayW, displayH);
    ctx.restore();

    if (!cropRect) return;

    const sx = displayW / sourceImage.naturalWidth;
    const sy = displayH / sourceImage.naturalHeight;
    const cx = cropRect.x * sx;
    const cy = cropRect.y * sy;
    const cw = cropRect.w * sx;
    const ch = cropRect.h * sy;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, displayW, cy);
    ctx.fillRect(0, cy, cx, ch);
    ctx.fillRect(cx + cw, cy, displayW - cx - cw, ch);
    ctx.fillRect(0, cy + ch, displayW, displayH - cy - ch);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(cx + (cw / 3) * i, cy);
      ctx.lineTo(cx + (cw / 3) * i, cy + ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy + (ch / 3) * i);
      ctx.lineTo(cx + cw, cy + (ch / 3) * i);
      ctx.stroke();
    }

    const hs = 10;
    const corners = [
      [cx, cy],
      [cx + cw, cy],
      [cx, cy + ch],
      [cx + cw, cy + ch],
    ];
    const edges = [
      [cx + cw / 2, cy],
      [cx + cw / 2, cy + ch],
      [cx, cy + ch / 2],
      [cx + cw, cy + ch / 2],
    ];

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 2;

    for (const [hx, hy] of [...corners, ...edges]) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }
  }, [cropRect, flipH, flipV, rotation, sourceImage]);

  const getMousePos = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    const { sx, sy } = getScale();

    return {
      x: ((clientX - rect.left) * (canvas.width / rect.width)) / sx,
      y: ((clientY - rect.top) * (canvas.height / rect.height)) / sy,
    };
  };

  const getHitZone = (mx: number, my: number): string | null => {
    if (!cropRect) return null;
    const margin = 15;
    const { x, y, w, h } = cropRect;

    if (Math.abs(mx - x) < margin && Math.abs(my - y) < margin) return 'nw';
    if (Math.abs(mx - (x + w)) < margin && Math.abs(my - y) < margin) return 'ne';
    if (Math.abs(mx - x) < margin && Math.abs(my - (y + h)) < margin) return 'sw';
    if (Math.abs(mx - (x + w)) < margin && Math.abs(my - (y + h)) < margin) return 'se';

    if (!selectedRatio) {
      if (Math.abs(my - y) < margin && mx > x && mx < x + w) return 'n';
      if (Math.abs(my - (y + h)) < margin && mx > x && mx < x + w) return 's';
      if (Math.abs(mx - x) < margin && my > y && my < y + h) return 'w';
      if (Math.abs(mx - (x + w)) < margin && my > y && my < y + h) return 'e';
    }

    if (mx > x && mx < x + w && my > y && my < y + h) return 'move';
    return null;
  };

  const handlePointerDown = (event: React.MouseEvent | React.TouchEvent) => {
    if (!cropRect || !sourceImage) return;

    const pos = getMousePos(event);
    const zone = getHitZone(pos.x, pos.y);
    if (!zone) return;

    event.preventDefault();
    dragStartRef.current = { mx: pos.x, my: pos.y, rect: { ...cropRect } };

    if (zone === 'move') {
      setIsDragging(true);
    } else {
      setIsResizing(zone);
    }
  };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const handlePointerMove = (event: React.MouseEvent | React.TouchEvent) => {
    if (!dragStartRef.current || !cropRect || !sourceImage) return;

    event.preventDefault();
    const pos = getMousePos(event);
    const { mx: startMx, my: startMy, rect: startRect } = dragStartRef.current;
    const dx = pos.x - startMx;
    const dy = pos.y - startMy;
    const imgW = sourceImage.naturalWidth;
    const imgH = sourceImage.naturalHeight;

    if (isDragging) {
      setCropRect({
        x: clamp(startRect.x + dx, 0, imgW - startRect.w),
        y: clamp(startRect.y + dy, 0, imgH - startRect.h),
        w: startRect.w,
        h: startRect.h,
      });
      return;
    }

    if (!isResizing) return;

    let { x, y, w, h } = startRect;

    if (selectedRatio) {
      const ratio = selectedRatio;

      if (isResizing.includes('e')) {
        w = clamp(startRect.w + dx, 50, imgW - x);
        h = w / ratio;
        if (y + h > imgH) {
          h = imgH - y;
          w = h * ratio;
        }
      } else if (isResizing.includes('w')) {
        w = clamp(startRect.w - dx, 50, startRect.x + startRect.w);
        h = w / ratio;
        x = startRect.x + startRect.w - w;
        if (x < 0) {
          x = 0;
          w = startRect.x + startRect.w;
          h = w / ratio;
        }
        if (y + h > imgH) {
          h = imgH - y;
          w = h * ratio;
          x = startRect.x + startRect.w - w;
        }
      } else if (isResizing.includes('s')) {
        h = clamp(startRect.h + dy, 50, imgH - y);
        w = h * ratio;
        if (x + w > imgW) {
          w = imgW - x;
          h = w / ratio;
        }
      } else if (isResizing.includes('n')) {
        h = clamp(startRect.h - dy, 50, startRect.y + startRect.h);
        w = h * ratio;
        y = startRect.y + startRect.h - h;
        if (y < 0) {
          y = 0;
          h = startRect.y + startRect.h;
          w = h * ratio;
        }
        if (x + w > imgW) {
          w = imgW - x;
          h = w / ratio;
          y = startRect.y + startRect.h - h;
        }
      }
    } else {
      if (isResizing.includes('e')) w = clamp(startRect.w + dx, 50, imgW - x);
      if (isResizing.includes('w')) {
        const right = startRect.x + startRect.w;
        x = clamp(startRect.x + dx, 0, right - 50);
        w = right - x;
      }
      if (isResizing.includes('s')) h = clamp(startRect.h + dy, 50, imgH - y);
      if (isResizing.includes('n')) {
        const bottom = startRect.y + startRect.h;
        y = clamp(startRect.y + dy, 0, bottom - 50);
        h = bottom - y;
      }
    }

    setCropRect({ x, y, w, h });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setIsResizing(null);
    dragStartRef.current = null;
  };

  const getCursor = (event: React.MouseEvent) => {
    if (!cropRect) return 'default';

    const zone = getHitZone(getMousePos(event).x, getMousePos(event).y);
    const cursors: Record<string, string> = {
      move: 'move',
      nw: 'nw-resize',
      ne: 'ne-resize',
      sw: 'sw-resize',
      se: 'se-resize',
      n: 'n-resize',
      s: 's-resize',
      w: 'w-resize',
      e: 'e-resize',
    };

    return zone ? cursors[zone] || 'default' : 'default';
  };

  const renderCroppedImage = () => {
    if (!sourceImage || !cropRect) return null;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = cropRect.w;
    outCanvas.height = cropRect.h;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.save();
    ctx.translate(cropRect.w / 2, cropRect.h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(
      sourceImage,
      cropRect.x,
      cropRect.y,
      cropRect.w,
      cropRect.h,
      -cropRect.w / 2,
      -cropRect.h / 2,
      cropRect.w,
      cropRect.h,
    );
    ctx.restore();

    return outCanvas.toDataURL('image/png');
  };

  const handleSaveCrop = async () => {
    if (!user || !cropRect) {
      toast.error('Zaloguj sie');
      return;
    }

    const dataUrl = renderCroppedImage();
    if (!dataUrl) return;

    try {
      const { trimmedCount } = await saveGraphicToGallery({
        userId: user.id,
        dataUrl,
        prompt: `[Kadrowanie] ${cropRect.w.toFixed(0)}x${cropRect.h.toFixed(0)}`,
        style: 'realistic',
        type: 'edited',
        dimensions: `${Math.round(cropRect.w)}x${Math.round(cropRect.h)}`,
      });
      const trimMessage = getTrimmedGraphicsMessage(trimmedCount);
      toast.success(trimMessage ? `Zapisano do galerii! ${trimMessage}` : 'Zapisano do galerii!');
    } catch {
      toast.error('Nie udalo sie zapisac');
    }
  };

  const handleDownloadCrop = () => {
    const dataUrl = renderCroppedImage();
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `kadr-${Date.now()}.png`;
    link.click();
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
              <Crop className="inline w-6 h-6 text-primary mr-2" />
              <span className="gradient-text">Kadrowanie</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Przytnij, obroc i odbij obraz. Przeciagnij ramke, aby ustawic obszar.
            </p>
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
                  <Link to="/auth?returnTo=/tools/crop">
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
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Move className="w-4 h-4 text-muted-foreground" /> Przeciagnij ramke lub uchwyty
                </p>
                <Button variant="ghost" size="sm" onClick={() => { setSourceImage(null); setSourcePreview(null); setCropRect(null); }}>
                  Zmien obraz
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant={selectedRatio === preset.ratio ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedRatio(preset.ratio)}
                    className={selectedRatio === preset.ratio ? 'gradient-bg' : ''}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setRotation((value) => (value + 90) % 360)} className="gap-1">
                  <RotateCw className="w-3.5 h-3.5" /> Obroc
                </Button>
                <Button variant="outline" size="sm" onClick={() => setFlipH((value) => !value)} className={`gap-1 ${flipH ? 'bg-primary/10' : ''}`}>
                  <FlipHorizontal className="w-3.5 h-3.5" /> Odbij H
                </Button>
                <Button variant="outline" size="sm" onClick={() => setFlipV((value) => !value)} className={`gap-1 ${flipV ? 'bg-primary/10' : ''}`}>
                  <FlipVertical className="w-3.5 h-3.5" /> Odbij V
                </Button>
              </div>

              <div
                ref={containerRef}
                className="rounded-lg overflow-hidden border bg-muted/30 select-none touch-none"
                style={{ cursor }}
              >
                <canvas
                  ref={canvasRef}
                  className="block w-full"
                  onMouseDown={handlePointerDown}
                  onMouseMove={(event) => {
                    setCursor(getCursor(event));
                    handlePointerMove(event);
                  }}
                  onMouseUp={handlePointerUp}
                  onMouseLeave={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                />
              </div>

              {cropRect && (
                <p className="text-xs text-muted-foreground">
                  Rozmiar wyniku: {cropRect.w.toFixed(0)} x {cropRect.h.toFixed(0)} px
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {user ? (
                  <Button onClick={handleSaveCrop} className="gradient-bg gap-1.5">
                    <Crop className="w-4 h-4" /> Zapisz do galerii
                  </Button>
                ) : (
                  <Link to="/auth?returnTo=/tools/crop">
                    <Button variant="outline" className="gap-1.5">
                      <Crop className="w-4 h-4" /> Zapisz w galerii po logowaniu
                    </Button>
                  </Link>
                )}
                <Button onClick={handleDownloadCrop} variant="outline" className="gap-1.5">
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

export default CropTool;
