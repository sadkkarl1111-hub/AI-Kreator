import { useState, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Minimize2, Upload, ArrowLeft, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

const ImageCompressor = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [originalSize, setOriginalSize] = useState(0);
  const [quality, setQuality] = useState(70);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setOriginalSize(file.size);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setResultUrl(null);
    };
    reader.readAsDataURL(file);
  };

  const compress = () => {
    if (!preview) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxWidth) {
        h = Math.round(h * (maxWidth / w));
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality / 100);
      setResultUrl(dataUrl);
      const base64 = dataUrl.split(',')[1];
      setResultSize(Math.round((base64.length * 3) / 4));
      toast.success('Kompresja zakończona!');
    };
    img.src = preview;
  };

  const download = () => {
    if (!resultUrl) return;
    const link = document.createElement('a');
    link.download = fileName.replace(/\.[^.]+$/, '') + '_compressed.jpg';
    link.href = resultUrl;
    link.click();
  };

  const savings = resultSize > 0 ? Math.round((1 - resultSize / originalSize) * 100) : 0;

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Minimize2 className="w-6 h-6 text-primary" /> Kompresja obrazu
            </h1>
            <p className="text-sm text-muted-foreground">Zmniejsz rozmiar pliku z regulacją jakości. Darmowe.</p>
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
                <img src={preview} alt="Źródło" className="max-h-48 mx-auto rounded-lg" />
                <p className="text-center text-sm text-muted-foreground">Oryginał: <strong>{formatSize(originalSize)}</strong></p>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Jakość: {quality}%</label>
                    <input type="range" min={5} max={100} value={quality} onChange={e => setQuality(+e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Maks. szerokość: {maxWidth}px</label>
                    <input type="range" min={320} max={3840} step={10} value={maxWidth} onChange={e => setMaxWidth(+e.target.value)} className="w-full" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={compress} className="gap-2"><Minimize2 className="w-4 h-4" /> Kompresuj</Button>
                  <Button variant="outline" onClick={() => { setPreview(null); setResultUrl(null); }}>Nowe zdjęcie</Button>
                </div>

                {resultUrl && (
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{formatSize(resultSize)}</span>
                      <span className={`text-sm font-bold ${savings > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {savings > 0 ? `-${savings}%` : `+${Math.abs(savings)}%`}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${100 - savings}%` }} />
                    </div>
                    <img src={resultUrl} alt="Wynik" className="max-h-48 mx-auto rounded" />
                    <Button onClick={download} className="gap-2"><Download className="w-4 h-4" /> Pobierz</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default ImageCompressor;
