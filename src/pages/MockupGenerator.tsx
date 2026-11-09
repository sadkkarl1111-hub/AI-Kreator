import { useState, useRef, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Monitor, Upload, ArrowLeft, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MOCKUPS, MOCKUP_CATEGORIES } from '@/components/mockup/mockupTemplates';
import { decodeLocalImage, fitImageRect } from '@/lib/localDesignExport';

const MockupGenerator = () => {
  const [selectedMockup, setSelectedMockup] = useState(MOCKUPS[0]);
  const [userImage, setUserImage] = useState<HTMLImageElement | null>(null);
  const [fit, setFit] = useState<'contain' | 'cover' | 'stretch'>('contain');
  const [reading, setReading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setReading(true);
    const url = URL.createObjectURL(file);
    try {
      setUserImage(await decodeLocalImage(url));
    } catch {
      toast.error('Nie udało się wczytać grafiki. Wybierz inny plik.');
    } finally {
      URL.revokeObjectURL(url);
      setReading(false);
    }
  };

  const drawMockup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { canvasW, canvasH, bgColor, imageArea, draw, drawOverlay } = selectedMockup;
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw mockup frame
    draw(ctx, canvasW, canvasH);

    // Place user image
    if (userImage) {
      const rect = fit === 'stretch'
        ? { x: 0, y: 0, width: imageArea.w, height: imageArea.h }
        : fitImageRect(userImage.naturalWidth, userImage.naturalHeight, imageArea.w, imageArea.h, fit);
      ctx.save();
      ctx.beginPath();
      ctx.rect(imageArea.x, imageArea.y, imageArea.w, imageArea.h);
      ctx.clip();
      ctx.drawImage(userImage, imageArea.x + rect.x, imageArea.y + rect.y, rect.width, rect.height);
      ctx.restore();
    } else {
      // Placeholder
      ctx.fillStyle = 'rgba(200,200,200,0.3)';
      ctx.fillRect(imageArea.x, imageArea.y, imageArea.w, imageArea.h);
      ctx.fillStyle = '#999';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Twoja grafika tutaj', imageArea.x + imageArea.w / 2, imageArea.y + imageArea.h / 2);
    }
    drawOverlay?.(ctx, canvasW, canvasH);
  }, [selectedMockup, userImage, fit]);

  useEffect(() => {
    drawMockup();
  }, [drawMockup]);

  const download = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `mockup-${selectedMockup.id}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    toast.success('Mockup pobrany!');
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Monitor className="w-6 h-6 text-primary" /> Generator mockupów</h1>
            <p className="text-sm text-muted-foreground">Pokaż swoją grafikę na urządzeniu, opakowaniu lub produkcie.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" disabled={reading} onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void handleFile(file);
            }} />

            <Button variant="outline" className="gap-2" disabled={reading} onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4" /> {reading ? 'Wczytuję grafikę…' : userImage ? 'Zmień grafikę' : 'Wgraj grafikę'}
            </Button>
            {userImage && <label className="grid gap-2 text-sm font-medium sm:max-w-xs">
              Dopasowanie grafiki
              <select value={fit} onChange={event => setFit(event.target.value as typeof fit)} className="min-h-11 rounded-md border bg-background px-3">
                <option value="contain">Cała grafika</option>
                <option value="cover">Wypełnij ramkę</option>
                <option value="stretch">Rozciągnij do ramki</option>
              </select>
            </label>}

            {/* Mockup selection by category */}
            <div className="space-y-3">
              {MOCKUP_CATEGORIES.map(cat => {
                const items = MOCKUPS.filter(m => m.category === cat);
                return (
                  <div key={cat}>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{cat}</label>
                    <div className="flex flex-wrap gap-2">
                      {items.map(m => (
                        <Button
                          key={m.id}
                          size="sm"
                          variant={selectedMockup.id === m.id ? 'default' : 'outline'}
                          onClick={() => setSelectedMockup(m)}
                          className="text-xs"
                        >
                          {m.emoji} {m.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <canvas ref={canvasRef} className="max-w-full max-h-[520px] mx-auto rounded-lg border bg-muted" style={{ display: 'block' }} />

            <Button onClick={download} disabled={reading} className="gap-2"><Download className="w-4 h-4" /> Pobierz mockup</Button>
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default MockupGenerator;
