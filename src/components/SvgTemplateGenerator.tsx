import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Shuffle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SvgColorInput, SvgExportActions } from '@/components/SvgControls';
import { DEFAULT_SVG_OPTIONS, SVG_STYLES, SVG_PALETTES, generateSvg, svgDataUrl, type SvgOptions } from '@/lib/svgTools';

export default function SvgTemplateGenerator() {
  const [params] = useSearchParams();
  const [options, setOptions] = useState<SvgOptions>(() => ({ ...DEFAULT_SVG_OPTIONS, style: SVG_STYLES.find(style => style.id === params.get('style'))?.id || 'waves' }));
  const update = <K extends keyof SvgOptions>(key: K, value: SvgOptions[K]) => setOptions(current => ({ ...current, [key]: value }));
  const svg = useMemo(() => generateSvg(options), [options]);
  const currentStyle = SVG_STYLES.find(style => style.id === options.style)!;
  const formats = [{ name: 'Poziomo', width: 1200, height: 800 }, { name: 'Kwadrat', width: 1080, height: 1080 }, { name: 'Stories', width: 1080, height: 1920 }, { name: 'Baner', width: 1600, height: 600 }];

  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 space-y-4 lg:sticky lg:top-20" aria-label="Podgląd grafiki">
        <Card><CardContent className="p-3 sm:p-5">
          <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
            <img src={svgDataUrl(svg)} alt={`Podgląd: ${currentStyle.name}`} className="max-h-[520px] w-full object-contain" />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{currentStyle.name} · {Math.min(4096, Math.max(64, options.width))} × {Math.min(4096, Math.max(64, options.height))} px</span><span>Skalowalna grafika wektorowa</span></div>
        </CardContent></Card>
        <SvgExportActions svg={svg} name={`grafika-${options.style}`} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 gap-2" onClick={() => update('seed', Math.floor(Math.random() * 2147483647))}><Shuffle className="h-4 w-4" />Losuj wariant</Button>
          <Button variant="ghost" className="h-11 gap-2" onClick={() => setOptions({ ...DEFAULT_SVG_OPTIONS })}><RotateCcw className="h-4 w-4" />Resetuj</Button>
          <Button asChild variant="link" className="h-11"><Link to="/tools/svg-library">Zobacz bibliotekę SVG</Link></Button>
        </div>
      </section>

      <Card className="min-w-0"><CardContent className="space-y-6 p-4 sm:p-5">
        <div className="space-y-3"><h2 className="font-semibold">Wybierz grafikę</h2><div className="grid grid-cols-2 gap-2">
          {SVG_STYLES.map(style => <button key={style.id} type="button" aria-pressed={options.style === style.id} onClick={() => update('style', style.id)} className={`min-w-0 overflow-hidden rounded-lg border p-2 text-left transition hover:border-primary ${options.style === style.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-background'}`}>
            <img src={svgDataUrl(generateSvg({ ...DEFAULT_SVG_OPTIONS, style: style.id, width: 180, height: 120 }))} alt="" loading="lazy" className="mb-2 aspect-[3/2] w-full rounded-md object-cover" />
            <span className="block text-xs font-medium">{style.name}</span>
          </button>)}
        </div></div>

        <div className="space-y-3"><h2 className="font-semibold">Kolory</h2><div className="flex flex-wrap gap-2">{SVG_PALETTES.map(palette => <button key={palette.name} type="button" title={palette.name} aria-label={`Paleta: ${palette.name}`} onClick={() => setOptions(current => ({ ...current, primary: palette.primary, secondary: palette.secondary, background: palette.background }))} className="flex h-11 w-11 overflow-hidden rounded-full border-4 border-background shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="w-1/2" style={{ backgroundColor: palette.primary }} /><span className="w-1/2" style={{ backgroundColor: palette.secondary }} /></button>)}</div>
          <div className="grid grid-cols-2 gap-3"><SvgColorInput id="svg-primary" label="Kolor główny" value={options.primary} onChange={value => update('primary', value)} /><SvgColorInput id="svg-secondary" label="Drugi kolor" value={options.secondary} onChange={value => update('secondary', value)} /></div>
          <SvgColorInput id="svg-background" label="Kolor tła" value={options.background} onChange={value => update('background', value)} />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><Checkbox checked={options.transparent} onCheckedChange={checked => update('transparent', checked === true)} />Przezroczyste tło</label>
        </div>

        <div className="space-y-3"><h2 className="font-semibold">Rozmiar</h2><div className="flex flex-wrap gap-2">{formats.map(format => <Button key={format.name} size="sm" variant={options.width === format.width && options.height === format.height ? 'default' : 'outline'} onClick={() => setOptions(current => ({ ...current, width: format.width, height: format.height }))}>{format.name}</Button>)}</div><div className="grid grid-cols-2 gap-3">{(['width', 'height'] as const).map(key => <div key={key} className="space-y-2"><Label htmlFor={`svg-${key}`}>{key === 'width' ? 'Szerokość' : 'Wysokość'} (px)</Label><Input id={`svg-${key}`} type="number" min={64} max={4096} value={options[key]} onChange={event => update(key, Number(event.target.value))} onBlur={() => update(key, Math.round(Math.min(4096, Math.max(64, options[key] || 800))))} /></div>)}</div><p className="text-xs text-muted-foreground">Od 64 do 4096 px. SVG zachowuje ostrość przy powiększaniu.</p></div>

        {['waves', 'blobs', 'rays', 'dots', 'grid', 'confetti'].includes(options.style) && <div className="space-y-2"><Label htmlFor="svg-density">Liczba elementów: {options.density}</Label><input id="svg-density" className="h-11 w-full accent-primary" type="range" min="4" max="40" value={options.density} onChange={event => update('density', Number(event.target.value))} /></div>}
        {options.style === 'sticker' && <div className="space-y-2"><Label htmlFor="svg-text">Napis na naklejce</Label><Input id="svg-text" maxLength={48} value={options.text} onChange={event => update('text', event.target.value)} /></div>}
        <p className="text-xs leading-relaxed text-muted-foreground">Podgląd zmienia się od razu. Grafiki powstają z gotowych kształtów; możesz używać ich w swoich projektach i reklamach.</p>
      </CardContent></Card>
    </div>;
}
