import { useState, useRef, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { QrCode, ArrowLeft, Download, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';

type ErrorLevel = 'L' | 'M' | 'Q' | 'H';

const QrCodeGenerator = () => {
  const [text, setText] = useState('https://');
  const [size, setSize] = useState(400);
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>('M');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [margin, setMargin] = useState(2);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const generateQr = useCallback(async () => {
    if (!text.trim() || !canvasRef.current) return;
    
    try {
      await QRCode.toCanvas(canvasRef.current, text, {
        width: size,
        margin,
        color: { dark: fgColor, light: bgColor },
        errorCorrectionLevel: errorLevel,
      });

      // Draw logo on top if provided
      if (logoUrl) {
        const ctx = canvasRef.current.getContext('2d')!;
        const img = new Image();
        img.onload = () => {
          const logoSize = size * 0.22;
          const x = (size - logoSize) / 2 + margin * 4;
          const y = (size - logoSize) / 2 + margin * 4;
          // White background behind logo
          const pad = 6;
          ctx.fillStyle = bgColor;
          ctx.beginPath();
          (ctx as any).roundRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, 8);
          ctx.fill();
          ctx.drawImage(img, x, y, logoSize, logoSize);
        };
        img.src = logoUrl;
      }
    } catch {
      // silently fail for invalid input
    }
  }, [text, size, fgColor, bgColor, errorLevel, logoUrl, margin]);

  useEffect(() => {
    generateQr();
  }, [generateQr]);

  const handleLogoFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoUrl(e.target?.result as string);
      // Need high error correction for logo
      setErrorLevel('H');
    };
    reader.readAsDataURL(file);
  };

  const download = (format: 'png' | 'svg') => {
    if (!text.trim()) { toast.error('Wpisz treść kodu QR'); return; }

    if (format === 'png') {
      if (!canvasRef.current) return;
      const link = document.createElement('a');
      link.download = 'qrcode.png';
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
      toast.success('QR Code pobrany jako PNG!');
    } else {
      QRCode.toString(text, {
        type: 'svg',
        width: size,
        margin,
        color: { dark: fgColor, light: bgColor },
        errorCorrectionLevel: errorLevel,
      }).then(svg => {
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const link = document.createElement('a');
        link.download = 'qrcode.svg';
        link.href = URL.createObjectURL(blob);
        link.click();
        toast.success('QR Code pobrany jako SVG!');
      });
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <QrCode className="w-6 h-6 text-primary" /> QR Code Generator
            </h1>
            <p className="text-sm text-muted-foreground">Generuj kody QR z kolorami, logo i eksportem SVG/PNG. Darmowe.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Settings */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Treść (URL, tekst, email, tel...)</label>
                <Input value={text} onChange={e => setText(e.target.value)} placeholder="https://example.com" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground">Kolor kodu</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={fgColor} onChange={e => setFgColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                    <span className="text-xs font-mono text-muted-foreground">{fgColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Kolor tła</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                    <span className="text-xs font-mono text-muted-foreground">{bgColor}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Rozmiar: {size}px</label>
                <input type="range" min={128} max={1024} step={16} value={size} onChange={e => setSize(+e.target.value)} className="w-full" />
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Margines: {margin}</label>
                <input type="range" min={0} max={8} value={margin} onChange={e => setMargin(+e.target.value)} className="w-full" />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Korekcja błędów:</label>
                <div className="flex gap-2">
                  {(['L', 'M', 'Q', 'H'] as ErrorLevel[]).map(l => (
                    <Button key={l} size="sm" variant={errorLevel === l ? 'default' : 'outline'} onClick={() => setErrorLevel(l)}>
                      {l} {l === 'L' ? '(7%)' : l === 'M' ? '(15%)' : l === 'Q' ? '(25%)' : '(30%)'}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleLogoFile(e.target.files[0])} />
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="w-4 h-4" /> {logoUrl ? 'Zmień logo' : 'Dodaj logo'}
                  </Button>
                  {logoUrl && (
                    <Button variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>Usuń logo</Button>
                  )}
                </div>
                {logoUrl && <p className="text-[10px] text-muted-foreground mt-1">Logo wymaga korekcji błędów H (30%) — ustawiono automatycznie.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Preview & Download */}
          <Card>
            <CardContent className="pt-6 space-y-4 flex flex-col items-center">
              <canvas
                ref={canvasRef}
                className="rounded-lg border max-w-full"
                style={{ width: Math.min(size, 350), height: Math.min(size, 350) }}
              />

              <div className="flex gap-3 w-full">
                <Button onClick={() => download('png')} className="flex-1 gap-2">
                  <Download className="w-4 h-4" /> PNG
                </Button>
                <Button onClick={() => download('svg')} variant="outline" className="flex-1 gap-2">
                  <Download className="w-4 h-4" /> SVG
                </Button>
              </div>

              <div className="text-xs text-muted-foreground text-center space-y-1">
                <p>Wskazówki:</p>
                <p>• URL, email (mailto:), telefon (tel:), Wi-Fi, tekst</p>
                <p>• Wyższy poziom korekcji = bardziej odporny kod</p>
                <p>• Logo wymaga poziomu H aby kod był czytelny</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default QrCodeGenerator;
