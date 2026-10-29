import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { getTrimmedGraphicsMessage, saveGraphicToGallery } from '@/lib/graphicsLimit';
import { loadImageFromUrlAsDataUrl } from '@/lib/toolImage';
import { vpsFetch } from '@/lib/vpsApi';

const templates = [
  { id: 'ig-post', label: 'Instagram Post', dims: '1080x1350', width: 1080, height: 1350, icon: 'IG', apiDims: '1024x1792' },
  { id: 'ig-story', label: 'Instagram Story', dims: '1080x1920', width: 1080, height: 1920, icon: 'ST', apiDims: '1024x1792' },
  { id: 'fb-cover', label: 'Facebook Cover', dims: '851x315', width: 851, height: 315, icon: 'FB', apiDims: '1792x1024' },
  { id: 'yt-thumb', label: 'YouTube Thumbnail', dims: '1280x720', width: 1280, height: 720, icon: 'YT', apiDims: '1792x1024' },
];

type Template = (typeof templates)[number];

function getTemplatePreviewStyle(template: Template) {
  const maxWidth = 112;
  const maxHeight = 72;
  const scale = Math.min(maxWidth / template.width, maxHeight / template.height);

  return {
    width: Math.round(template.width * scale),
    height: Math.round(template.height * scale),
  };
}

async function cropImageToTemplate(imageUrl: string, template: Template) {
  const image = await loadImageFromUrlAsDataUrl(imageUrl);

  return new Promise<string>((resolve, reject) => {
    const imageElement = new Image();
    imageElement.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = template.width;
      canvas.height = template.height;

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Nie udało się przygotować grafiki'));
        return;
      }

      const sourceWidth = imageElement.naturalWidth;
      const sourceHeight = imageElement.naturalHeight;
      const sourceRatio = sourceWidth / sourceHeight;
      const targetRatio = template.width / template.height;

      let cropWidth = sourceWidth;
      let cropHeight = sourceHeight;
      let cropX = 0;
      let cropY = 0;

      if (sourceRatio > targetRatio) {
        cropWidth = sourceHeight * targetRatio;
        cropX = (sourceWidth - cropWidth) / 2;
      } else {
        cropHeight = sourceWidth / targetRatio;
        cropY = (sourceHeight - cropHeight) / 2;
      }

      context.drawImage(
        imageElement,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        template.width,
        template.height,
      );

      resolve(canvas.toDataURL('image/png'));
    };
    imageElement.onerror = () => reject(new Error('Nie udało się załadować grafiki'));
    imageElement.src = image.dataUrl;
  });
}

const Templates = () => {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedTemplate = templates.find((template) => template.id === selected);

  const handleGenerate = async () => {
    if (!prompt.trim() || !selectedTemplate) {
      toast.error('Wybierz szablon i wpisz opis');
      return;
    }

    setGenerating(true);
    setGeneratedImage(null);

    try {
      const fullPrompt = [
        prompt,
        title && `with title text "${title}"`,
        subtitle && `with subtitle "${subtitle}"`,
        `Format: ${selectedTemplate.label} (${selectedTemplate.dims} px). Zachowaj proporcje ${selectedTemplate.width}:${selectedTemplate.height} i trzymaj ważne elementy blisko środka kadru`,
      ].filter(Boolean).join('. ');

      const data = await vpsFetch<{ imageUrl?: string; error?: string }>('/ai/generate-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: fullPrompt,
          style: 'realistic',
          dimensions: selectedTemplate.apiDims,
        }),
      });

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (!data.imageUrl) {
        setGeneratedImage(null);
        toast.error('Nie udało się wygenerować grafiki');
        return;
      }

      const finalImage = await cropImageToTemplate(data.imageUrl, selectedTemplate);
      setGeneratedImage(finalImage);
      toast.success('Grafika wygenerowana');
    } catch (error) {
      console.error(error);
      toast.error('Nie udało się wygenerować grafiki');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedImage || !selectedTemplate) return;
    if (!user) {
      toast.error('Musisz być zalogowany');
      return;
    }

    setSaving(true);

    try {
      const image = await loadImageFromUrlAsDataUrl(generatedImage);
      const { trimmedCount } = await saveGraphicToGallery({
        userId: user.id,
        dataUrl: image.dataUrl,
        prompt,
        style: 'template',
        type: 'template',
        dimensions: selectedTemplate.dims,
      });

      const trimMessage = getTrimmedGraphicsMessage(trimmedCount);
      if (trimMessage) toast.info(trimMessage);

      toast.success('Zapisano do galerii');
    } catch (error) {
      console.error(error);
      toast.error('Nie udało się zapisać');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;

    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `template-${selectedTemplate?.id ?? 'social'}-${Date.now()}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Nie udało się pobrać pliku');
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            <Sparkles className="inline w-6 h-6 text-primary mr-2" />
            Szablony <span className="gradient-text">Social Media</span>
          </h1>
          <p className="text-muted-foreground mt-1">Wybierz format i wygeneruj gotową grafikę.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {templates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${selected === template.id ? 'ring-2 ring-primary shadow-lg' : ''}`}
                onClick={() => {
                  setSelected(template.id);
                  setGeneratedImage(null);
                }}
              >
                <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                  <div className="flex h-[72px] w-full items-center justify-center">
                    <div
                      className="flex items-center justify-center rounded-md border border-primary/25 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 text-lg font-semibold"
                      style={getTemplatePreviewStyle(template)}
                    >
                      {template.icon}
                    </div>
                  </div>
                  <p className="font-medium mt-2 text-sm">{template.label}</p>
                  <p className="text-xs text-muted-foreground">{template.dims}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {selected && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {selectedTemplate?.icon} {selectedTemplate?.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Opisz tło grafiki..."
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input placeholder="Tytuł (opcjonalnie)" value={title} onChange={(event) => setTitle(event.target.value)} />
                    <Input placeholder="Podtytuł (opcjonalnie)" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
                  </div>
                  <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} className="w-full gradient-bg" size="lg">
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Generowanie...
                      </>
                    ) : (
                      'Generuj grafikę'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {generatedImage && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="overflow-hidden">
                <img src={generatedImage} alt={prompt} className="w-full" />
                <CardContent className="pt-4 flex flex-wrap gap-2">
                  <Button onClick={handleDownload} variant="outline" className="gap-1.5">
                    <Download className="w-4 h-4" /> Pobierz
                  </Button>
                  <Button onClick={handleSave} disabled={saving} className="gradient-bg gap-1.5">
                    <Save className="w-4 h-4" /> {saving ? 'Zapisywanie...' : 'Zapisz'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AppLayout>
  );
};

export default Templates;
