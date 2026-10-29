import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Plus, Copy, Trash2, BringToFront, SendToBack, LockKeyhole, LockKeyholeOpen, Minus, ZoomIn, RotateCw, ImagePlus, Award, Smile, Shapes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CarouselElementThumb } from '@/components/CarouselElementLibrary';
import { carouselElementToolbarPosition } from '@/lib/carouselElementControls';
import { stickerName, type SlideSticker } from '@/lib/carouselStickers';
import type { CarouselLibrarySource } from '@/lib/carouselLibrary';

type Props = {
  canvas: RefObject<HTMLCanvasElement>; stage: RefObject<HTMLDivElement>; sticker: SlideSticker; square: boolean; disabled: boolean; canDuplicate: boolean; canAdd: boolean;
  onAdd: (kind: string) => void; onLibrary: (source: CarouselLibrarySource) => void; onDuplicate: () => void; onDelete: () => void;
  onLayer: (front: boolean) => void; onEdit: (updates: Partial<SlideSticker>) => void;
};
export function CarouselElementToolbar({ canvas, stage, sticker, square, disabled, canDuplicate, canAdd, onAdd, onLibrary, onDuplicate, onDelete, onLayer, onEdit }: Props) {
  const toolbar = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<{ canvas: DOMRect; stage: DOMRect; width: number; height: number; viewport: number } | null>(null);
  const [adding, setAdding] = useState(false);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!canvas.current || !stage.current || !toolbar.current) return;
        setRects({ canvas: canvas.current.getBoundingClientRect(), stage: stage.current.getBoundingClientRect(), width: toolbar.current.offsetWidth, height: toolbar.current.offsetHeight, viewport: window.innerHeight });
      });
    };
    const observer = new ResizeObserver(measure);
    for (const target of [canvas.current, stage.current, toolbar.current]) if (target) observer.observe(target);
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true); measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [canvas, stage]);
  const position = rects && carouselElementToolbarPosition(rects.canvas, rects.stage, 1080, square ? 1080 : 1350, sticker, { width: rects.width, height: rects.height }, rects.viewport);
  const actions = [
    { label: 'Duplikuj zaznaczony element', icon: Copy, action: onDuplicate, blocked: !canDuplicate },
    { label: 'Zmniejsz element', icon: Minus, action: () => onEdit({ size: Math.max(6, sticker.size - 2) }), blocked: sticker.locked || sticker.size <= 6 },
    { label: 'Powiększ element', icon: ZoomIn, action: () => onEdit({ size: Math.min(60, sticker.size + 2) }), blocked: sticker.locked || sticker.size >= 60 },
    { label: 'Obróć element o 15°', icon: RotateCw, action: () => onEdit({ rotation: (sticker.rotation + 195) % 360 - 180 }), blocked: sticker.locked },
    { label: 'Przenieś element na wierzch', icon: BringToFront, action: () => onLayer(true) },
    { label: 'Przenieś element pod spód', icon: SendToBack, action: () => onLayer(false) },
    { label: sticker.locked ? 'Odblokuj element' : 'Zablokuj element', icon: sticker.locked ? LockKeyholeOpen : LockKeyhole, action: () => onEdit({ locked: !sticker.locked }), pressed: Boolean(sticker.locked) },
    { label: 'Usuń zaznaczony element', icon: Trash2, action: onDelete, danger: true },
  ];
  return <div ref={toolbar} role="toolbar" aria-label={`Narzędzia elementu: ${stickerName(sticker)}`} data-carousel-element-toolbar data-element-id={sticker.id} className="absolute z-20 flex w-max max-w-[calc(100%-12px)] flex-wrap items-center justify-center gap-0.5 rounded-xl border bg-background p-1 shadow-lg" style={{ left: position?.left || 6, top: position?.top || 6, visibility: position ? 'visible' : 'hidden' }} onPointerDown={event => event.stopPropagation()}>
    <Popover open={adding} onOpenChange={setAdding}><Tooltip><TooltipTrigger asChild><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Dodaj element obok" disabled={disabled || !canAdd}><Plus className="h-4 w-4"/></Button></PopoverTrigger></TooltipTrigger><TooltipContent>Dodaj element obok</TooltipContent></Tooltip>
      <PopoverContent data-carousel-element-add side="top" align="start" className="z-40 w-64 space-y-3 p-3"><p className="text-sm font-semibold">Dodaj przy zaznaczeniu</p><div className="grid grid-cols-3 gap-2">{[{ id: 'arrow-right', label: 'Strzałka' }, { id: 'star', label: 'Gwiazda' }, { id: 'heart', label: 'Serce' }, { id: 'pushpin', label: 'Pinezka' }, { id: 'sticky-note', label: 'Kartka' }, { id: 'speech-bubble', label: 'Dymek' }].map(item => <Button key={item.id} variant="outline" disabled={disabled || !canAdd} className="h-16 flex-col gap-0 px-1 text-[10px]" onClick={() => { onAdd(item.id); setAdding(false); }}><CarouselElementThumb kind={item.id} color={sticker.color} className="h-9 w-9"/>{item.label}</Button>)}</div><div className="grid gap-1">{([{ id: 'gallery', label: 'Moje grafiki', icon: ImagePlus }, { id: 'badges', label: 'Badge’e', icon: Award }, { id: 'emoji', label: 'Emoji', icon: Smile }, { id: 'icons', label: 'Ikony', icon: Shapes }] as const).map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" className="h-9 justify-start gap-2" disabled={disabled || !canAdd} onClick={() => { setAdding(false); onLibrary(id); }}><Icon className="h-4 w-4"/>{label}</Button>)}</div></PopoverContent>
    </Popover>
    {actions.map(({ label, icon: Icon, action, blocked, danger, pressed }) => <Tooltip key={label}><TooltipTrigger asChild><Button type="button" size="icon" variant={pressed ? 'secondary' : 'ghost'} aria-label={label} aria-pressed={pressed} disabled={disabled || blocked} className={`h-9 w-9 ${danger ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : ''}`} onClick={action}><Icon className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>)}
  </div>;
}
