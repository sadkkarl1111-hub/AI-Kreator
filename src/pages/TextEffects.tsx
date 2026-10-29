import { useMemo, useState } from 'react';
import { LocalSvgPreview, LocalSvgTool } from '@/components/LocalSvgTool';
import { SvgColorInput } from '@/components/SvgControls';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buildTextEffectSvg, defaultTextEffectOptions, TEXT_EFFECTS, TEXT_FONTS } from '@/lib/textEffects';

export default function TextEffects() {
  const [options, setOptions] = useState(defaultTextEffectOptions);
  const change = <K extends keyof typeof options>(key: K, value: typeof options[K]) => setOptions(previous => ({ ...previous, [key]: value }));
  const result = useMemo(() => {
    const context = document.createElement('canvas').getContext('2d');
    return context ? buildTextEffectSvg(options, (text, size, family, weight) => { context.font = `${weight} ${size}px ${family}`; return context.measureText(text).width; }) : null;
  }, [options]);
  return <LocalSvgTool title="Napisy z efektami" description="Stwórz napis do reklamy, miniatury lub badge’a. Podgląd zmienia się na żywo, bez wysyłania tekstu na serwer.">
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="min-w-0"><CardContent className="space-y-5 p-4 sm:p-5">
        <div className="space-y-2"><Label htmlFor="effect-text">Twój napis</Label><Textarea id="effect-text" value={options.text} onChange={event => change('text', event.target.value.split('\n').slice(0, 4).join('\n'))} maxLength={240} rows={3} placeholder="Wpisz swój tekst"/><p className="text-xs text-muted-foreground">Do 4 wierszy · {options.text.length}/240 znaków</p></div>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Efekt</legend><div className="grid grid-cols-3 gap-2">{TEXT_EFFECTS.map(effect => <Button key={effect.id} variant={options.effect === effect.id ? 'default' : 'outline'} aria-pressed={options.effect === effect.id} className="h-11 px-2" onClick={() => setOptions(previous => ({ ...previous, effect: effect.id, color: effect.color, accent: effect.accent, background: effect.background }))}>{effect.name}</Button>)}</div></fieldset>
        <div className="space-y-2"><Label htmlFor="effect-font">Krój pisma</Label><select id="effect-font" value={options.font} onChange={event => change('font', event.target.value)} className="h-11 w-full rounded-md border bg-background px-3 text-sm">{TEXT_FONTS.map(font => <option value={font.id} key={font.id}>{font.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3"><SvgColorInput id="effect-color" label="Kolor napisu" value={options.color} onChange={value => change('color', value)} /><SvgColorInput id="effect-accent" label="Kolor efektu" value={options.accent} onChange={value => change('accent', value)} /></div>
        <div className="space-y-2"><Label htmlFor="effect-size">Wielkość liter: {options.size}</Label><input id="effect-size" className="h-8 w-full accent-primary" type="range" min="48" max="220" value={options.size} onChange={event => change('size', Number(event.target.value))} /><p className="text-xs text-muted-foreground">Długi napis pomniejszamy, aby zmieścił się w grafice.</p></div>
        <div className="space-y-2"><Label htmlFor="effect-strength">Siła efektu: {options.strength}</Label><input id="effect-strength" className="h-8 w-full accent-primary" type="range" min="2" max="24" value={options.strength} onChange={event => change('strength', Number(event.target.value))} /></div>
        <div className="space-y-2"><Label htmlFor="effect-spacing">Odstęp liter: {options.spacing}</Label><input id="effect-spacing" className="h-8 w-full accent-primary" type="range" min="0" max="12" value={options.spacing} onChange={event => change('spacing', Number(event.target.value))} /></div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={options.transparent} onCheckedChange={value => change('transparent', value === true)} />Przezroczyste tło</label>
        {!options.transparent && <SvgColorInput id="effect-background" label="Kolor tła" value={options.background} onChange={value => change('background', value)} />}
        <p className="text-xs leading-relaxed text-muted-foreground">PNG zachowuje wygląd napisu z podglądu. SVG zawiera edytowalny tekst; jego krój może się zmienić na urządzeniu bez wybranej czcionki.</p>
      </CardContent></Card>
      {result ? <LocalSvgPreview svg={result.svg} title={`Napis: ${options.text}`} name="napis-z-efektem"><p className="text-xs text-muted-foreground">{result.width} × {result.height} px · SVG / PNG · litery {result.fontSize} px</p></LocalSvgPreview> : <div role="status" className="rounded-xl border p-12 text-center text-muted-foreground">Wpisz tekst, aby zobaczyć napis.</div>}
    </div>
  </LocalSvgTool>;
}
