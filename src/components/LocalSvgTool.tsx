import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SvgExportActions } from '@/components/SvgControls';
import { svgDataUrl } from '@/lib/svgTools';

export function LocalSvgTool({ title, description, children, workspace = false, badge = 'Darmowe · bez kredytów' }: { title: string; description: string; children: ReactNode; workspace?: boolean; badge?: string }) {
  return <AppLayout wide={workspace}><div className={`mx-auto min-w-0 ${workspace ? 'space-y-3 lg:space-y-0' : 'max-w-6xl space-y-6'}`}>
    <div className={`flex items-start gap-2 ${workspace ? 'lg:hidden' : ''}`}><Button asChild variant="ghost" size="icon" className="shrink-0"><Link to="/tools" aria-label="Wróć do narzędzi"><ArrowLeft className="h-4 w-4" /></Link></Button><div className={`min-w-0 ${workspace ? 'space-y-1' : 'space-y-2'}`}><div className={workspace ? 'flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1' : 'space-y-2'}><span className="inline-block rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">{badge}</span><h1 className={workspace ? 'text-xl font-bold sm:text-2xl' : 'text-2xl font-bold sm:text-3xl'}>{title}</h1></div><p className={workspace ? 'text-xs text-muted-foreground lg:sr-only' : 'text-sm text-muted-foreground'}>{description}</p></div></div>
    {children}
  </div></AppLayout>;
}

export function LocalSvgPreview({ svg, title, name, children }: { svg: string; title: string; name: string; children?: ReactNode }) {
  return <section className="min-w-0 space-y-4 lg:sticky lg:top-20" aria-label="Podgląd wyniku">
    <Card><CardContent className="space-y-3 p-3 sm:p-5"><div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
      <img src={svgDataUrl(svg)} alt={title} className="max-h-[560px] w-full object-contain" />
    </div>{children}</CardContent></Card>
    <SvgExportActions svg={svg} name={name} />
  </section>;
}
