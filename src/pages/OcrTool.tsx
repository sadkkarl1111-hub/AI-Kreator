import { useState, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ScanText, Upload, ArrowLeft, Copy, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { vpsFetch } from '@/lib/vpsApi';

const OcrTool = () => {
  const [image, setImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Plik za duży (max 10MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFile(file);
  };

  const extractText = async () => {
    if (!image) return;
    setLoading(true);
    setExtractedText('');
    try {
      const data = await vpsFetch<{ text?: string; error?: string }>('/ai/ocr', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: image }),
      });
      if (data?.error) throw new Error(data.error);
      setExtractedText(data.text || '(brak tekstu)');
      toast.success('Tekst wyciągnięty!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Błąd OCR');
    } finally {
      setLoading(false);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(extractedText);
    toast.success('Skopiowano do schowka!');
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><ScanText className="w-6 h-6 text-primary" /> OCR — Tekst ze zdjęcia</h1>
            <p className="text-sm text-muted-foreground">Wyciągnij tekst z obrazu za pomocą AI. Obsługuje polskie znaki.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {!image ? (
              <div
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Kliknij lub upuść obraz z tekstem</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — max 10MB</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <img src={image} alt="Do OCR" className="max-h-[300px] rounded-lg border mx-auto object-contain" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => { setImage(null); setExtractedText(''); }}
                  >
                    Zmień
                  </Button>
                </div>

                <Button onClick={extractText} disabled={loading} className="gap-2 w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}
                  {loading ? 'Rozpoznaję tekst...' : 'Wyciągnij tekst'}
                </Button>

                {extractedText && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Rozpoznany tekst:</label>
                      <Button variant="outline" size="sm" className="gap-1" onClick={copyText}>
                        <Copy className="w-3 h-3" /> Kopiuj
                      </Button>
                    </div>
                    <Textarea
                      value={extractedText}
                      onChange={e => setExtractedText(e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                    />
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

export default OcrTool;
