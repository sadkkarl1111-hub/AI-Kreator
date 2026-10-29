import { useState, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Pipette, Upload, ArrowLeft, Copy, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ColorInfo {
  hex: string;
  rgb: string;
  hsl: string;
  count: number;
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function extractColors(imageData: ImageData, numColors: number = 8): ColorInfo[] {
  const pixels: number[][] = [];
  for (let i = 0; i < imageData.data.length; i += 16) { // sample every 4th pixel
    pixels.push([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]]);
  }

  // Simple quantization via bucketing
  const bucketSize = 32;
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  
  for (const [r, g, b] of pixels) {
    const key = `${Math.floor(r / bucketSize)}-${Math.floor(g / bucketSize)}-${Math.floor(b / bucketSize)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, numColors);

  return sorted.map(bucket => {
    const r = Math.round(bucket.r / bucket.count);
    const g = Math.round(bucket.g / bucket.count);
    const b = Math.round(bucket.b / bucket.count);
    return {
      hex: rgbToHex(r, g, b),
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: rgbToHsl(r, g, b),
      count: bucket.count,
    };
  });
}

const ColorPalette = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorInfo[]>([]);
  const [numColors, setNumColors] = useState(8);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPreview(url);
      
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        setColors(extractColors(imageData, numColors));
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  }, [numColors]);

  const copyColor = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`Skopiowano: ${value}`);
  };

  const downloadPalette = () => {
    const canvas = document.createElement('canvas');
    const w = 800, h = 200;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const sw = w / colors.length;
    colors.forEach((c, i) => {
      ctx.fillStyle = c.hex;
      ctx.fillRect(i * sw, 0, sw, h - 40);
      ctx.fillStyle = '#000';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillRect(i * sw, h - 40, sw, 40);
      ctx.fillStyle = '#fff';
      ctx.fillText(c.hex, i * sw + sw / 2, h - 15);
    });
    const link = document.createElement('a');
    link.download = 'paleta.png';
    link.href = canvas.toDataURL();
    link.click();
    toast.success('Paleta pobrana!');
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Pipette className="w-6 h-6 text-primary" /> Paleta kolorów
            </h1>
            <p className="text-sm text-muted-foreground">Wyciągnij dominujące kolory ze zdjęcia. Darmowe.</p>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <Card>
          <CardContent className="pt-6 space-y-4">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            
            {!preview ? (
              <div
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Kliknij aby wgrać zdjęcie</p>
              </div>
            ) : (
              <div className="space-y-4">
                <img src={preview} alt="Źródło" className="max-h-64 mx-auto rounded-lg" />
                
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="text-sm text-muted-foreground">Ilość kolorów:</label>
                  {[4, 6, 8, 10, 12].map(n => (
                    <Button key={n} size="sm" variant={numColors === n ? 'default' : 'outline'} onClick={() => {
                      setNumColors(n);
                      if (preview) {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = canvasRef.current!;
                          canvas.width = 200; canvas.height = 200;
                          const ctx = canvas.getContext('2d')!;
                          ctx.drawImage(img, 0, 0, 200, 200);
                          setColors(extractColors(ctx.getImageData(0, 0, 200, 200), n));
                        };
                        img.src = preview;
                      }
                    }}>{n}</Button>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => { setPreview(null); setColors([]); }}>Nowe zdjęcie</Button>
                </div>

                {colors.length > 0 && (
                  <>
                    <div className="flex h-20 rounded-lg overflow-hidden shadow-lg">
                      {colors.map((c, i) => (
                        <div key={i} className="flex-1 cursor-pointer hover:scale-y-110 transition-transform" style={{ backgroundColor: c.hex }} onClick={() => copyColor(c.hex)} title={c.hex} />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {colors.map((c, i) => (
                        <div key={i} className="rounded-lg border p-2 space-y-1">
                          <div className="w-full h-10 rounded" style={{ backgroundColor: c.hex }} />
                          <button className="w-full text-left text-xs font-mono flex items-center gap-1 hover:text-primary" onClick={() => copyColor(c.hex)}>
                            <Copy className="w-3 h-3" /> {c.hex}
                          </button>
                          <p className="text-[10px] text-muted-foreground">{c.rgb}</p>
                          <p className="text-[10px] text-muted-foreground">{c.hsl}</p>
                        </div>
                      ))}
                    </div>

                    <Button onClick={downloadPalette} className="gap-2"><Download className="w-4 h-4" /> Pobierz paletę</Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default ColorPalette;
