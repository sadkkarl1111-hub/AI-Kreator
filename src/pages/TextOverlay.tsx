import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Type, Download, Upload, Image, ArrowLeft, Plus, Trash2, Move, Bold, Italic } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTrimmedGraphicsMessage, saveGraphicToGallery } from '@/lib/graphicsLimit';
import { loadImageFromUrlAsDataUrl, loadUserGalleryImages, readImageFile } from '@/lib/toolImage';

type TextLayer = {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  font: string;
  bold: boolean;
  italic: boolean;
  shadow: boolean;
  rotation: number;
  bgEnabled: boolean;
  bgColor: string;
  bgPaddingX: number;
  bgPaddingY: number;
  bgRadius: number;
};

const FONTS = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Impact',
  'Comic Sans MS',
  'Trebuchet MS',
  'Palatino',
];

const TextOverlay = () => {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayScale = useRef(1);

  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ layerId: string; offsetX: number; offsetY: number } | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ id: string; url: string; prompt: string }[]>([]);

  const applySourceImage = useCallback((dataUrl: string) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSourceImage(img);
      setShowGallery(false);
      setLayers([]);
      setSelectedLayer(null);
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

  const addLayer = () => {
    const id = crypto.randomUUID();
    const layer: TextLayer = {
      id,
      text: 'Twoj tekst',
      x: 50,
      y: 50,
      size: 48,
      color: '#ffffff',
      font: 'Arial',
      bold: true,
      italic: false,
      shadow: true,
      rotation: 0,
      bgEnabled: false,
      bgColor: '#000000',
      bgPaddingX: 12,
      bgPaddingY: 6,
      bgRadius: 4,
    };

    setLayers((current) => [...current, layer]);
    setSelectedLayer(id);
  };

  const updateLayer = (id: string, updates: Partial<TextLayer>) => {
    setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...updates } : layer)));
  };

  const removeLayer = (id: string) => {
    setLayers((current) => current.filter((layer) => layer.id !== id));
    if (selectedLayer === id) setSelectedLayer(null);
  };

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
    displayScale.current = displayW / sourceImage.naturalWidth;
    ctx.clearRect(0, 0, displayW, displayH);
    ctx.drawImage(sourceImage, 0, 0, displayW, displayH);

    const scale = displayScale.current;
    for (const layer of layers) {
      ctx.save();
      const lx = layer.x * scale;
      const ly = layer.y * scale;
      const fontSize = layer.size * scale;
      ctx.translate(lx, ly);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${fontSize}px "${layer.font}"`;
      ctx.textBaseline = 'top';
      const metrics = ctx.measureText(layer.text);

      if (layer.bgEnabled) {
        const px = layer.bgPaddingX * scale;
        const py = layer.bgPaddingY * scale;
        const radius = layer.bgRadius * scale;
        const bx = -px;
        const by = -py;
        const bw = metrics.width + px * 2;
        const bh = fontSize + py * 2;
        ctx.fillStyle = layer.bgColor;
        ctx.beginPath();
        ctx.moveTo(bx + radius, by);
        ctx.lineTo(bx + bw - radius, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
        ctx.lineTo(bx + bw, by + bh - radius);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
        ctx.lineTo(bx + radius, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
        ctx.lineTo(bx, by + radius);
        ctx.quadraticCurveTo(bx, by, bx + radius, by);
        ctx.closePath();
        ctx.fill();
      }

      if (layer.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 6 * scale;
        ctx.shadowOffsetX = 2 * scale;
        ctx.shadowOffsetY = 2 * scale;
      }

      ctx.fillStyle = layer.color;
      ctx.fillText(layer.text, 0, 0);

      if (layer.id === selectedLayer) {
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'hsl(var(--primary))';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-4, -4, metrics.width + 8, fontSize + 8);
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }, [layers, selectedLayer, sourceImage]);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const scale = displayScale.current;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const layer = layers[i];
      const lx = layer.x * scale;
      const ly = layer.y * scale;
      const fontSize = layer.size * scale;
      ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${fontSize}px "${layer.font}"`;
      const width = ctx.measureText(layer.text).width;

      if (mx >= lx && mx <= lx + width && my >= ly && my <= ly + fontSize) {
        setSelectedLayer(layer.id);
        setDragging({ layerId: layer.id, offsetX: mx - lx, offsetY: my - ly });
        return;
      }
    }

    setSelectedLayer(null);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const scale = displayScale.current;

    updateLayer(dragging.layerId, {
      x: (mx - dragging.offsetX) / scale,
      y: (my - dragging.offsetY) / scale,
    });
  };

  const handleMouseUp = () => setDragging(null);

  const exportFullRes = () => {
    if (!sourceImage) return null;

    const out = document.createElement('canvas');
    out.width = sourceImage.naturalWidth;
    out.height = sourceImage.naturalHeight;
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(sourceImage, 0, 0);

    for (const layer of layers) {
      ctx.save();
      ctx.translate(layer.x, layer.y);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${layer.size}px "${layer.font}"`;
      ctx.textBaseline = 'top';
      const metrics = ctx.measureText(layer.text);

      if (layer.bgEnabled) {
        const px = layer.bgPaddingX;
        const py = layer.bgPaddingY;
        const radius = layer.bgRadius;
        const bx = -px;
        const by = -py;
        const bw = metrics.width + px * 2;
        const bh = layer.size + py * 2;
        ctx.fillStyle = layer.bgColor;
        ctx.beginPath();
        ctx.moveTo(bx + radius, by);
        ctx.lineTo(bx + bw - radius, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
        ctx.lineTo(bx + bw, by + bh - radius);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
        ctx.lineTo(bx + radius, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
        ctx.lineTo(bx, by + radius);
        ctx.quadraticCurveTo(bx, by, bx + radius, by);
        ctx.closePath();
        ctx.fill();
      }

      if (layer.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      ctx.fillStyle = layer.color;
      ctx.fillText(layer.text, 0, 0);
      ctx.restore();
    }

    return out.toDataURL('image/png');
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Zaloguj sie');
      return;
    }

    const dataUrl = exportFullRes();
    if (!dataUrl) return;

    try {
      const { trimmedCount } = await saveGraphicToGallery({
        userId: user.id,
        dataUrl,
        prompt: `[Tekst] ${layers.map((layer) => layer.text).join(', ')}`,
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
    const dataUrl = exportFullRes();
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `tekst-${Date.now()}.png`;
    link.click();
  };

  const current = layers.find((layer) => layer.id === selectedLayer);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              <Type className="inline w-6 h-6 text-primary mr-2" />
              Tekst na <span className="gradient-text">obrazie</span>
            </h1>
            <p className="text-muted-foreground mt-1">Dodaj napisy, kolory, tlo i zapisuj wynik przez VPS.</p>
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
                  <Link to="/auth?returnTo=/tools/text">
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
          <>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Podglad</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addLayer} className="gap-1">
                      <Plus className="w-3.5 h-3.5" /> Dodaj tekst
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSourceImage(null); setLayers([]); }}>
                      Zmien obraz
                    </Button>
                  </div>
                </div>

                <div
                  ref={containerRef}
                  className="rounded-lg overflow-hidden border bg-muted/30 select-none"
                  style={{ cursor: dragging ? 'grabbing' : 'default' }}
                >
                  <canvas
                    ref={canvasRef}
                    className="block w-full"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  />
                </div>

                <p className="text-[10px] text-muted-foreground">
                  <Move className="w-3 h-3 inline" /> Kliknij tekst, aby go wybrac i przeciagnij, aby przesunac.
                </p>
              </CardContent>
            </Card>

            {current && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Edycja warstwy</p>
                    <Button variant="destructive" size="sm" onClick={() => removeLayer(current.id)} className="gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Usun
                    </Button>
                  </div>

                  <Input value={current.text} onChange={(event) => updateLayer(current.id, { text: event.target.value })} placeholder="Wpisz tekst..." />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Font</label>
                      <Select value={current.font} onValueChange={(value) => updateLayer(current.id, { font: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FONTS.map((font) => (
                            <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                              {font}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Kolor</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={current.color} onChange={(event) => updateLayer(current.id, { color: event.target.value })} className="w-10 h-10 rounded border cursor-pointer" />
                        <Input value={current.color} onChange={(event) => updateLayer(current.id, { color: event.target.value })} className="flex-1" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs w-20 shrink-0">Rozmiar: {current.size}px</span>
                      <Slider value={[current.size]} onValueChange={([value]) => updateLayer(current.id, { size: value })} min={12} max={200} step={1} className="flex-1" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs w-20 shrink-0">Obrot: {current.rotation}deg</span>
                      <Slider value={[current.rotation]} onValueChange={([value]) => updateLayer(current.id, { rotation: value })} min={-180} max={180} step={1} className="flex-1" />
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button variant={current.bold ? 'default' : 'outline'} size="sm" onClick={() => updateLayer(current.id, { bold: !current.bold })}>
                      <Bold className="w-4 h-4" />
                    </Button>
                    <Button variant={current.italic ? 'default' : 'outline'} size="sm" onClick={() => updateLayer(current.id, { italic: !current.italic })}>
                      <Italic className="w-4 h-4" />
                    </Button>
                    <Button variant={current.shadow ? 'default' : 'outline'} size="sm" onClick={() => updateLayer(current.id, { shadow: !current.shadow })}>
                      Cien
                    </Button>
                    <Button variant={current.bgEnabled ? 'default' : 'outline'} size="sm" onClick={() => updateLayer(current.id, { bgEnabled: !current.bgEnabled })}>
                      Tlo
                    </Button>
                  </div>

                  {current.bgEnabled && (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground">Tlo tekstu</p>
                      <div className="flex gap-2 items-center">
                        <label className="text-xs text-muted-foreground w-12 shrink-0">Kolor</label>
                        <input type="color" value={current.bgColor} onChange={(event) => updateLayer(current.id, { bgColor: event.target.value })} className="w-10 h-10 rounded border cursor-pointer" />
                        <Input value={current.bgColor} onChange={(event) => updateLayer(current.id, { bgColor: event.target.value })} className="flex-1" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs w-24 shrink-0">Szer. L/P: {current.bgPaddingX}px</span>
                        <Slider value={[current.bgPaddingX]} onValueChange={([value]) => updateLayer(current.id, { bgPaddingX: value })} min={0} max={100} step={1} className="flex-1" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs w-24 shrink-0">Wys. G/D: {current.bgPaddingY}px</span>
                        <Slider value={[current.bgPaddingY]} onValueChange={([value]) => updateLayer(current.id, { bgPaddingY: value })} min={0} max={100} step={1} className="flex-1" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs w-24 shrink-0">Zaokr.: {current.bgRadius}px</span>
                        <Slider value={[current.bgRadius]} onValueChange={([value]) => updateLayer(current.id, { bgRadius: value })} min={0} max={50} step={1} className="flex-1" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {layers.length > 0 && (
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <p className="text-sm font-medium">Warstwy ({layers.length})</p>
                  {layers.map((layer, index) => (
                    <button
                      key={layer.id}
                      onClick={() => setSelectedLayer(layer.id)}
                      className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${layer.id === selectedLayer ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                    >
                      <span className="font-medium">{index + 1}.</span> {layer.text || '(pusty)'}
                      <span className="text-xs text-muted-foreground ml-2">{layer.font} {layer.size}px</span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-2">
              {user ? (
                <Button onClick={handleSave} className="gradient-bg gap-1.5">
                  <Type className="w-4 h-4" /> Zapisz do galerii
                </Button>
              ) : (
                <Link to="/auth?returnTo=/tools/text">
                  <Button variant="outline" className="gap-1.5">
                    <Type className="w-4 h-4" /> Zapisz w galerii po logowaniu
                  </Button>
                </Link>
              )}
              <Button onClick={handleDownload} variant="outline" className="gap-1.5">
                <Download className="w-4 h-4" /> Pobierz
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default TextOverlay;
