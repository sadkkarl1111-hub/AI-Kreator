import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Shapes } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SvgTemplateGenerator from '@/components/SvgTemplateGenerator';
import SvgPromptGenerator from '@/components/SvgPromptGenerator';

export default function SvgGenerator() {
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'templates' || (!params.has('mode') && params.has('style')) ? 'templates' : 'ai';
  return <AppLayout><main className="mx-auto max-w-6xl min-w-0 space-y-6">
    <div className="flex items-start gap-2 sm:gap-3">
      <Button asChild variant="ghost" size="icon" className="shrink-0"><Link to="/tools" aria-label="Wróć do narzędzi"><ArrowLeft className="h-4 w-4" /></Link></Button>
      <div className="min-w-0"><h1 className="text-2xl font-bold sm:text-3xl"><Shapes className="mr-2 inline h-6 w-6 text-primary" />Generator <span className="gradient-text">SVG</span></h1><p className="mt-1 text-sm text-muted-foreground">Opisz swoją grafikę i wygeneruj SVG z pomocą AI. Pobierz też wersję PNG.</p></div>
    </div>
    <Tabs value={mode} onValueChange={value => { const next = new URLSearchParams(params); next.set('mode', value); setParams(next, { replace: true }); }}>
      <TabsList className="mb-5 h-12 w-full sm:w-auto"><TabsTrigger value="ai" className="h-10 flex-1">Z prompta AI · płatne</TabsTrigger><TabsTrigger value="templates" className="h-10 flex-1">Darmowe szablony</TabsTrigger></TabsList>
      <TabsContent value="ai"><SvgPromptGenerator /></TabsContent>
      <TabsContent value="templates"><SvgTemplateGenerator /></TabsContent>
    </Tabs>
  </main></AppLayout>;
}
