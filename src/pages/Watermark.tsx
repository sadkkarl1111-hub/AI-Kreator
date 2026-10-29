import { useState, useRef, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Stamp, Upload, ArrowLeft, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile';

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'bottom-right', label: '↘ Prawy dół' },
  { value: 'bottom-left', label: '↙ Lewy dół' },
  { value: 'top-right', label: '↗ Prawy góra' },
  { value: 'top-left', label: '↖ Lewy góra' },
  { value: 'center', label: '⊕ Środek' },
  { value: 'tile', label: '▦ Kafelkowy' },
];

const Watermark = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState('© Twoja Marka');
  const [fontSize, setFontSize] = useState(32);
  const [opacity, setOpacity] = useState(30);
  const [position, setPosition] = useState<Position>('bottom-right');
  const [color, setColor] = useState('#ffffff');
  const [rotation, setRotation] = useState(-30);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPreview(url);
      const img = new Image();
      img.onload = () => { imgRef.current = img; };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px Arial`;

    if (position === 'tile') {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      const step = fontSize * 5;
      for (let y = -canvas.height; y < canvas.height * 2; y += step) {
        for (let x = -canvas.width; x < canvas.width * 2; x += step) {
          ctx.fillText(text, x - canvas.width / 2, y - canvas.height / 2);
        }
      }
      ctx.restore();
    } else {
      const pad = 30;
      let x = pad, y = canvas.height - pad;
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';

      switch (position) {
        case 'top-left': y = pad + fontSize; break;
        case 'top-right': x = canvas.width - pad; y = pad + fontSize; ctx.textAlign = 'right'; break;
        case 'bottom-right': x = canvas.width - pad; ctx.textAlign = 'right'; break;
        case 'center': x = canvas.width / 2; y = canvas.height / 2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; break;
      }
      ctx.fillText(text, x, y);
    }
    ctx.globalAlpha = 1;
  }, [text, fontSize, opacity, position, color, rotation]);

  useEffect(() => {
    if (imgRef.current) drawPreview();
  }, [drawPreview, preview]);

  const download = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'watermark.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    toast.success('Pobrano!');
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Stamp className="w-6 h-6 text-primary" /> Watermark</h1>
            <p className="text-sm text-muted-foreground">Dodaj znak wodny na zdjęcie. Darmowe.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {!preview ? (
              <div className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Kliknij aby wgrać zdjęcie</p>
              </div>
            ) : (
              <div className="space-y-4">
                <canvas ref={canvasRef} className="max-w-full max-h-[400px] mx-auto rounded-lg object-contain" style={{ display: 'block' }} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Tekst</label>
                    <Input value={text} onChange={e => setText(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Pozycja</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {POSITIONS.map(p => (
                        <Button key={p.value} size="sm" variant={position === p.value ? 'default' : 'outline'} onClick={() => setPosition(p.value)} className="text-xs">{p.label}</Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Rozmiar: {fontSize}px</label>
                    <input type="range" min={12} max={120} value={fontSize} onChange={e => setFontSize(+e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Przezroczystość: {opacity}%</label>
                    <input type="range" min={5} max={100} value={opacity} onChange={e => setOpacity(+e.target.value)} className="w-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Kolor:</label>
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                  </div>
                  {position === 'tile' && (
                    <div>
                      <label className="text-sm text-muted-foreground">Obrót: {rotation}°</label>
                      <input type="range" min={-90} max={90} value={rotation} onChange={e => setRotation(+e.target.value)} className="w-full" />
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button onClick={download} className="gap-2"><Download className="w-4 h-4" /> Pobierz</Button>
                  <Button variant="outline" onClick={() => { setPreview(null); imgRef.current = null; }}>Nowe zdjęcie</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default Watermark;
