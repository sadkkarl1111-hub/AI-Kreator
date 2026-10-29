import { useState, useRef } from 'react';
import { vpsFetch } from '@/lib/vpsApi';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAiModels } from '@/hooks/useAiModels';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Copy, Upload, ArrowLeft, Download, Loader2, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolPricing } from '@/hooks/useToolPricing';

const VARIANT_STYLES = [
  { value: 'similar', label: '🔄 Podobny', prompt: 'Create a variation of this image. Keep the same subject, composition, and style but make subtle creative changes to lighting, angle, or details.' },
  { value: 'artistic', label: '🎨 Artystyczny', prompt: 'Create an artistic variation of this image. Transform it into a more artistic, painterly style while keeping the same subject.' },
  { value: 'dramatic', label: '🌅 Dramatyczny', prompt: 'Create a dramatic variation of this image. Enhance the mood with dramatic lighting, deeper shadows, and more intense colors.' },
  { value: 'minimal', label: '⬜ Minimalistyczny', prompt: 'Create a minimalist variation of this image. Simplify the composition, reduce details, and create a clean, minimal aesthetic.' },
  { value: 'vintage', label: '📷 Vintage', prompt: 'Create a vintage variation of this image. Add film grain, warm tones, slight vignetting, and a nostalgic feel.' },
];

const ImageVariants = () => {
  const { user } = useAuth();
  const { balance, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { aiModels, selectedModel, selectedModelOption, setSelectedModel } = useAiModels({ purpose: 'editing' });

  const [preview, setPreview] = useState<string | null>(null);
  const [sourceBase64, setSourceBase64] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState('image/png');
  const [variants, setVariants] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [variantStyle, setVariantStyle] = useState(VARIANT_STYLES[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modelCost = selectedModelOption?.cost ?? 50;
  const { cost: toolCost } = useToolPricing('variants');
  const currentModelCost = toolCost ?? modelCost;

  const handleFile = (file: File) => {
    setSourceMime(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPreview(url);
      setSourceBase64(url.split(',')[1]);
      setVariants([]);
    };
    reader.readAsDataURL(file);
  };

  const generateVariant = async () => {
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
          prompt: variantStyle.prompt,
          model: selectedModel,
          toolId: 'variants',
        }),
      });

      if (data?.error) throw new Error(data.error);

      if (data?.imageUrl) {
        setVariants(prev => [...prev, data.imageUrl]);
        toast.success('Wariant wygenerowany!');
        refetchCredits();
      }
    } catch (err: any) {
      toast.error(err.message || 'Błąd generowania');
    } finally {
      setProcessing(false);
    }
  };

  const downloadVariant = (url: string, i: number) => {
    const link = document.createElement('a');
    link.download = `variant-${i + 1}.png`;
    link.href = url;
    link.click();
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Copy className="w-6 h-6 text-primary" /> Generowanie wariantów</h1>
            <p className="text-sm text-muted-foreground">Twórz różne wersje istniejącego obrazu z pomocą AI.</p>
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
                <p className="text-muted-foreground">Wgraj zdjęcie źródłowe</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Styl wariantu:</label>
                  <div className="flex flex-wrap gap-2">
                    {VARIANT_STYLES.map(s => (
                      <Button key={s.value} size="sm" variant={variantStyle.value === s.value ? 'default' : 'outline'} onClick={() => setVariantStyle(s)}>{s.label}</Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Oryginał</p>
                    <img src={preview} alt="Oryginał" className="w-full rounded-lg border-2 border-primary/30" />
                  </div>
                  {variants.map((url, i) => (
                    <div key={i} className="relative group">
                      <p className="text-xs text-muted-foreground mb-1">Wariant {i + 1}</p>
                      <img src={url} alt={`Wariant ${i + 1}`} className="w-full rounded-lg" />
                      <Button size="icon" variant="secondary" className="absolute top-6 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7" onClick={() => downloadVariant(url, i)}>
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 flex-wrap">
                  <Button onClick={generateVariant} disabled={processing} className="gap-2">
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                    {processing ? 'Generowanie...' : `Generuj wariant (${currentModelCost} pkt)`}
                  </Button>
                  <Button variant="outline" onClick={() => { setPreview(null); setVariants([]); }}>Nowe zdjęcie</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default ImageVariants;
