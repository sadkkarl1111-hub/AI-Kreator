import { useState, useRef, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { FlipHorizontal2, FlipVertical2, Upload, ArrowLeft, Download, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

const FlipTool = () => {
  const [image, setImage] = useState<string | null>(null);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setImage(e.target?.result as string);
        setFlipH(false);
        setFlipV(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.save();
    ctx.translate(flipH ? canvas.width : 0, flipV ? canvas.height : 0);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }, [flipH, flipV]);

  useEffect(() => {
    if (image) drawImage();
  }, [image, drawImage]);

  const download = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `flip-${flipH ? 'h' : ''}${flipV ? 'v' : ''}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    toast.success('Obraz pobrany!');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFile(file);
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FlipHorizontal2 className="w-6 h-6 text-primary" /> Odbicie (Flip)</h1>
            <p className="text-sm text-muted-foreground">Odbij obraz w pionie lub poziomie. Darmowe.</p>
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
                <p className="text-muted-foreground">Kliknij lub upuść obraz</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={flipH ? 'default' : 'outline'}
                    className="gap-2"
                    onClick={() => setFlipH(!flipH)}
                  >
                    <FlipHorizontal2 className="w-4 h-4" /> Odbij poziomo
                  </Button>
                  <Button
                    variant={flipV ? 'default' : 'outline'}
                    className="gap-2"
                    onClick={() => setFlipV(!flipV)}
                  >
                    <FlipVertical2 className="w-4 h-4" /> Odbij pionowo
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => { setFlipH(false); setFlipV(false); }}>
                    <RotateCcw className="w-4 h-4" /> Reset
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setImage(null); setFlipH(false); setFlipV(false); }}>
                    Zmień obraz
                  </Button>
                </div>

                <canvas ref={canvasRef} className="max-w-full max-h-[500px] mx-auto rounded-lg border bg-muted" style={{ display: 'block' }} />

                <Button onClick={download} className="gap-2"><Download className="w-4 h-4" /> Pobierz</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default FlipTool;
