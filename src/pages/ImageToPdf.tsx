import { useState, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { FileText, Upload, ArrowLeft, Download, Trash2, GripVertical } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PageImage {
  id: string;
  url: string;
  name: string;
}

const ImageToPdf = () => {
  const [images, setImages] = useState<PageImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImages(prev => [...prev, {
          id: Math.random().toString(36).slice(2),
          url: e.target?.result as string,
          name: file.name,
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= images.length) return;
    const arr = [...images];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    setImages(arr);
  };

  const generatePdf = async () => {
    if (images.length === 0) { toast.error('Dodaj przynajmniej 1 zdjęcie'); return; }
    setGenerating(true);

    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < images.length; i++) {
        if (i > 0) pdf.addPage();

        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const ratio = Math.min(pageW / img.naturalWidth, pageH / img.naturalHeight);
            const w = img.naturalWidth * ratio;
            const h = img.naturalHeight * ratio;
            const x = (pageW - w) / 2;
            const y = (pageH - h) / 2;
            pdf.addImage(img, 'JPEG', x, y, w, h);
            resolve();
          };
          img.src = images[i].url;
        });
      }

      pdf.save('images.pdf');
      toast.success('PDF wygenerowany!');
    } catch (err) {
      toast.error('Błąd generowania PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" /> Obrazy → PDF</h1>
            <p className="text-sm text-muted-foreground">Połącz wiele zdjęć w jeden plik PDF. Darmowe.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />

            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" /> Dodaj zdjęcia
              </Button>
              <div className="flex gap-2">
                <Button size="sm" variant={orientation === 'portrait' ? 'default' : 'outline'} onClick={() => setOrientation('portrait')}>📄 Pionowo</Button>
                <Button size="sm" variant={orientation === 'landscape' ? 'default' : 'outline'} onClick={() => setOrientation('landscape')}>📄 Poziomo</Button>
              </div>
            </div>

            {images.length === 0 ? (
              <div className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Kliknij aby dodać zdjęcia do PDF</p>
              </div>
            ) : (
              <div className="space-y-2">
                {images.map((img, i) => (
                  <div key={img.id} className="flex items-center gap-3 border rounded-lg p-2">
                    <span className="text-sm text-muted-foreground w-6 text-center">{i + 1}</span>
                    <img src={img.url} alt={img.name} className="w-16 h-16 object-cover rounded" />
                    <span className="text-sm flex-1 truncate">{img.name}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => moveImage(i, -1)} disabled={i === 0}><GripVertical className="w-4 h-4 rotate-180" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => moveImage(i, 1)} disabled={i === images.length - 1}><GripVertical className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeImage(img.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {images.length > 0 && (
              <Button onClick={generatePdf} disabled={generating} className="gap-2">
                <Download className="w-4 h-4" /> {generating ? 'Generowanie...' : `Generuj PDF (${images.length} stron)`}
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default ImageToPdf;
