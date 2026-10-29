import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAiModels } from '@/hooks/useAiModels';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Hexagon, ArrowLeft, Download, Loader2, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolPricing } from '@/hooks/useToolPricing';
import { vpsFetch } from '@/lib/vpsApi';

const LOGO_STYLES = [
  { value: 'minimalist', label: '⬜ Minimalistyczne', desc: 'Proste, czyste linie' },
  { value: 'gradient', label: '🌈 Gradientowe', desc: 'Nowoczesne z gradientem' },
  { value: 'vintage', label: '📜 Vintage', desc: 'Retro, klasyczne' },
  { value: 'geometric', label: '🔷 Geometryczne', desc: 'Kształty geometryczne' },
  { value: 'mascot', label: '🐻 Maskotka', desc: 'Z postacią/zwierzęciem' },
  { value: 'lettermark', label: '🔤 Literowe', desc: 'Na bazie liter/inicjałów' },
];

const LogoMaker = () => {
  const { user } = useAuth();
  const { balance, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { aiModels, selectedModel, selectedModelOption, setSelectedModel } = useAiModels({ purpose: 'generation' });

  const [brandName, setBrandName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(LOGO_STYLES[0]);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const modelCost = selectedModelOption?.cost ?? 50;
  const { cost: toolCost } = useToolPricing('logo');
  const currentModelCost = toolCost ?? modelCost;

  const generateLogo = async () => {
    if (!brandName.trim() || !user) {
      toast.error('Podaj nazwę marki');
      return;
    }
    if (!isAdmin && balance < currentModelCost) {
      toast.error(`Za mało kredytów (potrzebujesz ${currentModelCost})`);
      return;
    }

    setProcessing(true);
    try {
      const stylePrompts: Record<string, string> = {
        minimalist: 'minimalist, clean lines, simple, flat design, modern',
        gradient: 'modern gradient colors, vibrant, sleek, contemporary',
        vintage: 'vintage, retro, classic, aged, traditional, ornamental',
        geometric: 'geometric shapes, abstract, angular, structured',
        mascot: 'cute mascot character, friendly, cartoon style, memorable',
        lettermark: 'lettermark, typography-based, initials, typographic logo',
      };

      const prompt = `Design a professional logo for "${brandName}". Style: ${stylePrompts[selectedStyle.value]}. ${description ? `Brand description: ${description}.` : ''} The logo should be on a clean white background, vector-like quality, suitable for business use. No text unless it's the brand name.`;

      const data = await vpsFetch<{ imageUrl?: string; error?: string }>('/ai/generate-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          model: selectedModel,
          style: 'realistic',
          dimensions: '1024x1024',
          toolId: 'logo',
        }),
      });

      if (data?.error) throw new Error(data.error);

      if (data?.imageUrl) {
        setResultImages(prev => [data.imageUrl, ...prev]);
        toast.success('Logo wygenerowane!');
        refetchCredits();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Błąd generowania logo');
    } finally {
      setProcessing(false);
    }
  };

  const downloadLogo = (url: string, i: number) => {
    const link = document.createElement('a');
    link.download = `logo-${brandName.replace(/\s+/g, '-')}-${i + 1}.png`;
    link.href = url;
    link.click();
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Hexagon className="w-6 h-6 text-primary" /> Logo Maker</h1>
            <p className="text-sm text-muted-foreground">Wygeneruj logo dla swojej marki z pomocą AI.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
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

            <div>
              <label className="text-sm text-muted-foreground">Nazwa marki *</label>
              <Input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="np. TechVision, EcoShop..." maxLength={50} />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Opis marki (opcjonalnie)</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Czym zajmuje się Twoja firma? Jaki jest jej charakter?" rows={2} maxLength={200} />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Styl logo:</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LOGO_STYLES.map(s => (
                  <Button key={s.value} variant={selectedStyle.value === s.value ? 'default' : 'outline'} className="h-auto py-2 flex-col items-start text-left" onClick={() => setSelectedStyle(s)}>
                    <span className="text-sm">{s.label}</span>
                    <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={generateLogo} disabled={processing || !brandName.trim()} className="gap-2 w-full">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hexagon className="w-4 h-4" />}
              {processing ? 'Generowanie...' : `Generuj logo (${currentModelCost} pkt)`}
            </Button>

            {resultImages.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Wygenerowane logo ({resultImages.length}):</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {resultImages.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt={`Logo ${i + 1}`} className="w-full rounded-lg border bg-white" />
                      <Button size="icon" variant="secondary" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8" onClick={() => downloadLogo(url, i)}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default LogoMaker;
