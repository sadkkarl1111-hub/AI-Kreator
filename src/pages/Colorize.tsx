import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAiModels } from '@/hooks/useAiModels';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Palette, Upload, ArrowLeft, Download, Loader2, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolPricing } from '@/hooks/useToolPricing';
import { vpsFetch } from '@/lib/vpsApi';

const Colorize = () => {
  const { user } = useAuth();
  const { balance, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { aiModels, selectedModel, selectedModelOption, setSelectedModel } = useAiModels({ purpose: 'editing' });

  const [preview, setPreview] = useState<string | null>(null);
  const [sourceBase64, setSourceBase64] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState('image/png');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modelCost = selectedModelOption?.cost ?? 50;
  const { cost: toolCost } = useToolPricing('colorize');
  const currentModelCost = toolCost ?? modelCost;

  const handleFile = (file: File) => {
    setSourceMime(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPreview(url);
      setSourceBase64(url.split(',')[1]);
      setResultImage(null);
    };
    reader.readAsDataURL(file);
  };

  const colorize = async () => {
    if (!sourceBase64 || !user) return;
    if (!isAdmin && balance < currentModelCost) {
      toast.error(`Za mało kredytów (potrzebujesz ${currentModelCost})`);
      return;
    }

    setProcessing(true);
    try {
      const data = await vpsFetch<{ imageUrl?: string; error?: string }>('/ai/edit-image', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: sourceBase64,
          mimeType: sourceMime,
          prompt: 'Colorize this black and white photograph. Add natural, realistic colors. Preserve all details and textures of the original image. Make it look like a naturally colored photograph.',
          model: selectedModel,
          toolId: 'colorize',
        }),
      });

      if (data?.error) throw new Error(data.error);

      if (data?.imageUrl) {
        setResultImage(data.imageUrl);
        toast.success('Koloryzacja zakończona!');
        refetchCredits();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Błąd koloryzacji');
    } finally {
      setProcessing(false);
    }
  };

  const download = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.download = 'colorized.png';
    link.href = resultImage;
    link.click();
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Palette className="w-6 h-6 text-primary" /> Koloryzacja B&W</h1>
            <p className="text-sm text-muted-foreground">Pokoloruj czarno-białe zdjęcia za pomocą AI.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {aiModels.length > 1 && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Model AI:</label>
                <div className="flex flex-wrap gap-2">
                  {aiModels.map(m => (
                    <Button key={m.id} size="sm" variant={selectedModel === m.id ? 'default' : 'outline'} onClick={() => setSelectedModel(m.id)}>
                      {m.label} ({m.cost} <Coins className="w-3 h-3 inline" />)
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {!preview ? (
              <div className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Wgraj czarno-białe zdjęcie</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Oryginał</p>
                    <img src={preview} alt="Oryginał" className="w-full rounded-lg" />
                  </div>
                  {resultImage && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Pokolorowane</p>
                      <img src={resultImage} alt="Wynik" className="w-full rounded-lg" />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 flex-wrap">
                  <Button onClick={colorize} disabled={processing} className="gap-2">
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                    {processing ? 'Koloryzacja...' : `Pokoloruj (${currentModelCost} pkt)`}
                  </Button>
                  {resultImage && <Button variant="outline" onClick={download} className="gap-2"><Download className="w-4 h-4" /> Pobierz</Button>}
                  <Button variant="outline" onClick={() => { setPreview(null); setResultImage(null); }}>Nowe zdjęcie</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default Colorize;
