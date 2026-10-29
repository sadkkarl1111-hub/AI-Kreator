import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Pencil, Minus, ZoomIn, RotateCw, AlignCenter, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { carouselElementToolbarPosition } from '@/lib/carouselElementControls';
import { CAROUSEL_TEXT_LABELS, type CarouselTextBox, type CarouselTextFrame } from '@/lib/carouselTextGeometry';

export function CarouselTextToolbar({ canvas, stage, box, frame, height, disabled, onChange, onEdit, onReset }: { canvas: RefObject<HTMLCanvasElement>; stage: RefObject<HTMLDivElement>; box: CarouselTextBox; frame: CarouselTextFrame; height: number; disabled: boolean; onChange: (patch: CarouselTextFrame) => void; onEdit: () => void; onReset: () => void }) {
  const toolbar = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<{ canvas: DOMRect; stage: DOMRect; width: number; height: number; viewport: number } | null>(null);
  useLayoutEffect(() => {
    let frameId = 0;
    const measure = () => { cancelAnimationFrame(frameId); frameId = requestAnimationFrame(() => { if (canvas.current && stage.current && toolbar.current) setRects({ canvas: canvas.current.getBoundingClientRect(), stage: stage.current.getBoundingClientRect(), width: toolbar.current.offsetWidth, height: toolbar.current.offsetHeight, viewport: innerHeight }); }); };
    const observer = new ResizeObserver(measure);
    for (const target of [canvas.current, stage.current, toolbar.current]) if (target) observer.observe(target);
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true); measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frameId); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [canvas, stage]);
  const position = rects && carouselElementToolbarPosition(rects.canvas, rects.stage, 1080, height, { x: box.x / 1080 * 100, y: box.y / height * 100, rotation: box.rotation, size: 0 }, rects, rects.viewport, box);
  const scale = frame.scale ?? 100;
  const actions = [
    { label: 'Edytuj zaznaczony napis', icon: Pencil, action: onEdit },
    { label: 'Zmniejsz cały napis', icon: Minus, action: () => onChange({ scale: Math.max(50, scale - 10) }), blocked: scale <= 50 },
    { label: 'Powiększ cały napis', icon: ZoomIn, action: () => onChange({ scale: Math.min(250, scale + 10) }), blocked: scale >= 250 },
    { label: 'Obróć napis o 15°', icon: RotateCw, action: () => onChange({ rotation: ((frame.rotation ?? 0) + 195) % 360 - 180 }) },
    { label: 'Wyśrodkuj pole napisu', icon: AlignCenter, action: () => onChange({ x: 50 }) },
    { label: 'Przywróć położenie napisu', icon: Undo2, action: onReset },
  ];
  return <div ref={toolbar} data-carousel-text-toolbar role="toolbar" aria-label={`Narzędzia napisu: ${CAROUSEL_TEXT_LABELS[box.field]}`} className="absolute z-20 flex w-max max-w-[calc(100%-12px)] flex-wrap justify-center gap-0.5 rounded-xl border bg-background p-1 shadow-lg" style={{ left: position?.left ?? 6, top: position?.top ?? 6, visibility: position ? 'visible' : 'hidden' }} onPointerDown={event => event.stopPropagation()}>{actions.map(({ label, icon: Icon, action, blocked }) => <Button key={label} type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={disabled || blocked} aria-label={label} title={label} onClick={action}><Icon className="h-4 w-4"/></Button>)}</div>;
}
