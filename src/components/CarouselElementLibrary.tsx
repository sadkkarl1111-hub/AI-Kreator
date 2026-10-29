import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImagePlus, Award, Smile, Shapes } from 'lucide-react';
import type { CarouselLibrarySource } from '@/lib/carouselLibrary';
import { CAROUSEL_STICKERS, CAROUSEL_STICKER_GROUPS, drawSlideStickers } from '@/lib/carouselStickers';
import { CAROUSEL_ELEMENT_MIME } from '@/lib/carouselDrop';
export type ElementDragHandlers = { onDragKind: (kind: string | null) => void; onTouchMove: (kind: string, x: number, y: number) => void; onTouchDrop: (kind: string, x: number, y: number) => void; onDragCancel: () => void };
export function CarouselElementThumb({ kind, color, className = '' }: { kind: string; color: string; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const target = canvas.current, context = target?.getContext('2d'); if (!target || !context) return; context.clearRect(0, 0, 96, 96); drawSlideStickers(context, [{ id: 'thumb', kind, x: 50, y: 50, size: 82, rotation: 0, color, motion: 'none' }], 96, 96); }, [kind, color]);
  return <canvas ref={canvas} width={96} height={96} aria-hidden="true" className={className}/>;
}
export function CarouselElementTile({ kind, color, disabled, onActivate, drag, compact = false }: { kind: string; color: string; disabled: boolean; onActivate: () => void; drag: ElementDragHandlers; compact?: boolean }) {
  const tracking = useRef<{ pointer: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(0);
  const item = CAROUSEL_STICKERS.find(item => item.id === kind)!;
  return <Button title={`${item.name} — przeciągnij lub wybierz`} aria-label={`Dodaj element: ${item.name}`} data-carousel-element={kind} variant="outline" disabled={disabled} draggable={!disabled} className={`${compact ? 'h-16 lg:h-14' : 'h-20'} min-w-0 touch-none cursor-grab flex-col gap-0 px-1 py-1 active:cursor-grabbing`}
    onDragStart={event => { event.dataTransfer.setData(CAROUSEL_ELEMENT_MIME, kind); event.dataTransfer.effectAllowed = 'copy'; const thumbnail = event.currentTarget.querySelector('canvas'); if (thumbnail) event.dataTransfer.setDragImage(thumbnail, 48, 48); suppressClick.current = Date.now() + 600; drag.onDragKind(kind); }}
    onDragEnd={() => { suppressClick.current = Date.now() + 300; drag.onDragCancel(); }}
    onPointerDown={event => { if (disabled || event.pointerType === 'mouse' || !event.isPrimary) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); tracking.current = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false }; }}
    onPointerMove={event => { const active = tracking.current; if (!active || active.pointer !== event.pointerId) return; if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 7) active.moved = true; if (active.moved) { event.preventDefault(); drag.onTouchMove(kind, event.clientX, event.clientY); } }}
    onPointerUp={event => { const active = tracking.current; if (!active || active.pointer !== event.pointerId) return; tracking.current = null; event.preventDefault(); suppressClick.current = Date.now() + 500; if (active.moved) drag.onTouchDrop(kind, event.clientX, event.clientY); else onActivate(); drag.onDragCancel(); }}
    onPointerCancel={() => { tracking.current = null; suppressClick.current = Date.now() + 300; drag.onDragCancel(); }}
    onClick={() => { if (Date.now() >= suppressClick.current) onActivate(); }}>
    <CarouselElementThumb kind={kind} color={color} className={`pointer-events-none shrink-0 ${compact ? 'h-10 w-10 lg:h-8 lg:w-8' : 'h-12 w-12'}`}/><span className="pointer-events-none max-w-full truncate text-[10px]">{item.name}</span>
  </Button>;
}
export function CarouselQuickElements({ color, disabled, drag, onChoose, onLibrary, libraryDisabled, desktopCompact = false }: { color: string; disabled: boolean; drag: ElementDragHandlers; onChoose: (kind: string) => void; onLibrary: (source: CarouselLibrarySource) => void; libraryDisabled: boolean; desktopCompact?: boolean }) {
  const [query, setQuery] = useState(''), [group, setGroup] = useState('Strzałki');
  const row = useRef<HTMLDivElement>(null);
  const items = CAROUSEL_STICKERS.filter(item => (group === 'Wszystkie' || item.group === group) && item.name.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')));
  return <div className={`min-w-0 shrink-0 space-y-2 rounded-lg border bg-card p-2 ${desktopCompact ? 'lg:flex lg:items-center lg:gap-2 lg:space-y-0' : 'sm:p-3'}`} role="region" aria-label="Pasek elementów nad grafiką">
    <div className={desktopCompact ? 'grid grid-cols-2 gap-1 sm:grid-cols-4 lg:hidden' : 'grid grid-cols-2 gap-1 sm:grid-cols-4'}>{([{ id: 'gallery', label: 'Moje grafiki', icon: ImagePlus }, { id: 'badges', label: 'Badge’e', icon: Award }, { id: 'emoji', label: 'Emoji', icon: Smile }, { id: 'icons', label: 'Ikony', icon: Shapes }] as const).map(({ id, label, icon: Icon }) => <Button key={id} variant="outline" disabled={libraryDisabled} className="h-9 min-w-0 gap-1 px-1 text-xs" onClick={() => onLibrary(id)}><Icon className="h-4 w-4 shrink-0"/>{label}</Button>)}</div>
    <div className={`grid min-w-0 grid-cols-2 gap-2 ${desktopCompact ? 'lg:w-60 lg:shrink-0' : ''}`}><select disabled={disabled} aria-label="Kategoria elementów do przeciągania" value={group} onChange={event => { setGroup(event.target.value); setQuery(''); }} className="h-9 min-w-0 rounded border bg-background px-2 text-xs">{CAROUSEL_STICKER_GROUPS.map(name => <option key={name}>{name}</option>)}</select><Input disabled={disabled} aria-label="Szukaj elementów do przeciągania" placeholder="Szukaj elementu…" value={query} onChange={event => setQuery(event.target.value)} className="h-9 min-w-0"/></div>
    <div className={`flex min-w-0 items-center gap-1 ${desktopCompact ? 'lg:flex-1' : ''}`}><Button variant="ghost" className="h-11 w-7 shrink-0 px-0" aria-label="Poprzednie elementy" onClick={() => row.current?.scrollBy({ left: -180, behavior: 'smooth' })}>‹</Button><div ref={row} key={`${group}-${query}`} className="flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain p-1" aria-label="Elementy do dodania">{items.map(item => <div key={item.id} className="w-[76px] shrink-0 [&>button]:w-full"><CarouselElementTile kind={item.id} color={color} disabled={disabled} onActivate={() => onChoose(item.id)} drag={drag} compact/></div>)}</div><Button variant="ghost" className="h-11 w-7 shrink-0 px-0" aria-label="Następne elementy" onClick={() => row.current?.scrollBy({ left: 180, behavior: 'smooth' })}>›</Button></div>
    {!items.length && <p className="py-2 text-xs text-muted-foreground">Brak elementów dla tego wyszukiwania.</p>}
    <p className={`text-[11px] text-muted-foreground ${desktopCompact ? 'lg:hidden' : ''}`}>Kliknij, aby dodać od razu, lub przeciągnij na grafikę. Przewiń pasek, aby zobaczyć więcej.</p>
  </div>;
}
