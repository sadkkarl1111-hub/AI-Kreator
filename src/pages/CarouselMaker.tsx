import { useCallback, useEffect, useRef, useState, type PointerEvent, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Loader2, Plus, Trash2, Undo2, Redo2, ImagePlus, Award, Smile, Shapes } from 'lucide-react';
import { LocalSvgTool } from '@/components/LocalSvgTool';
import { SvgColorInput } from '@/components/SvgControls';
import { Button } from '@/components/ui/button';
import { CarouselWorkspaceSidebar, type CarouselPanel } from '@/components/CarouselWorkspaceSidebar';
import { CarouselSlideThumbnail } from '@/components/CarouselSlideThumbnail';
import { CarouselElementToolbar } from '@/components/CarouselElementToolbar';
import { CarouselAiGenerator } from '@/components/CarouselAiGenerator';
import { useCarouselGeneratorAccess } from '@/hooks/useCarouselGeneratorAccess';
import { canDuplicateCarouselSticker, duplicateCarouselSticker } from '@/lib/carouselElementControls';
import '@/components/carouselWorkspace.css';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CarouselTemplateLibrary } from '@/components/CarouselTemplateLibrary';
import { CarouselNavigationEditor } from '@/components/CarouselNavigationEditor';
import { CarouselConversionEditor } from '@/components/CarouselConversionEditor';
import { CarouselAssetLibrary } from '@/components/CarouselAssetLibrary';
import { CarouselTextEditor } from '@/components/CarouselTextEditor';
import { CarouselTextTransformEditor } from '@/components/CarouselTextTransformEditor';
import { CarouselTextToolbar } from '@/components/CarouselTextToolbar';
import { carouselTextHit, carouselWordAtPoint, clampTextCenter, type CarouselTextBox, type CarouselTextField, type CarouselTextFrame } from '@/lib/carouselTextGeometry';
import { CarouselStickerEditor } from '@/components/CarouselStickerEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { CAROUSEL_BACKGROUNDS, CAROUSEL_THEMES, CAROUSEL_TONES, renderCarouselSlide, type CarouselDesign, type CarouselSlide } from '@/lib/carouselDesign';
import { parseCarouselProject, serializeCarouselProject } from '@/lib/carouselProject';
import { canvasPng, decodeLocalImage, readLocalDesignImage, saveLocalBlob } from '@/lib/localDesignExport';
import { CAROUSEL_FONTS } from '@/lib/carouselRichText';
import { CAROUSEL_STICKERS, MAX_CAROUSEL_ELEMENTS, MAX_CUSTOM_STICKERS, createCarouselSticker, createCarouselEmoji, drawSlideStickers, moveSticker, snapStickerPosition, stickerHit, reorderSticker } from '@/lib/carouselStickers';
import { readCarouselLibraryImage, type CarouselLibrarySource, type CarouselLibraryImage, type CarouselImageTarget } from '@/lib/carouselLibrary';
import { getStoredAuthSession } from '@/lib/authSession';
import { exportSlideGif } from '@/lib/carouselGif';
import { isStickerAnimated, loadStickerAsset, loadStickerImages, readStickerFile, validateCarouselAssets } from '@/lib/carouselStickerAssets';
import { useCarouselDocument } from '@/hooks/useCarouselDocument';
import { CAROUSEL_IMAGE_FRAMES } from '@/lib/carouselFrames';
import { ensureCarouselFonts, prepareCarouselTemplate } from '@/lib/carouselTemplateAssets';
import { CarouselElementThumb, CarouselQuickElements, type ElementDragHandlers } from '@/components/CarouselElementLibrary';
import { CAROUSEL_ELEMENT_MIME, carouselDropPoint } from '@/lib/carouselDrop';

export default function CarouselMaker() {
  const editor = useCarouselDocument();
  const { slides, design, setSlides, setDesign, replace, ready, saveStatus, undo, redo, begin, end } = editor;
  const [requestedSlide, setSelected] = useState(0);
  const selected = Math.min(requestedSlide, slides.length - 1);
  const [template, setTemplate] = useState('creator-red-manifest');
  const [sidebar, setSidebar] = useState<CarouselPanel>('templates');
  const [snapping, setSnapping] = useState(true);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const generatorAccess = useCarouselGeneratorAccess();
  const [exportingGif, setExportingGif] = useState(false);
  const [rendered, setRendered] = useState<{ slide: CarouselSlide; design: CarouselDesign; selected: number; count: number; textBoxes: CarouselTextBox[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fits, setFits] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [assetLibrary, setAssetLibrary] = useState<CarouselLibrarySource | null>(null);
  const [dropHover, setDropHover] = useState(false);
  const [libraryDrag, setLibraryDrag] = useState<{ kind: string; x: number; y: number } | null>(null);
  const [dragKind, setDragKind] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const canvasStage = useRef<HTMLDivElement>(null);
  const uploadJob = useRef(0);
  const gifJob = useRef<AbortController | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const textDrag = useRef<{ field: CarouselTextField; box: CarouselTextBox; dx: number; dy: number; clientX: number; clientY: number; moved?: boolean } | null>(null);
  const [selectedText, setSelectedText] = useState<CarouselTextField | null>(null);
  const [textSelection, setTextSelection] = useState<{ field: CarouselTextField; start: number; end: number; nonce: number } | null>(null);
  const [selectedSticker, setStickerSelection] = useState('');
  const setSelectedSticker = useCallback((id: string) => { setStickerSelection(id); if (id) setSelectedText(null); }, []);
  const [animate, setAnimate] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const slide = slides[selected];
  const activeSticker = slide.stickers?.find(item => item.id === selectedSticker && !item.hidden);
  const textBoxes = rendered?.slide === slide && rendered.design === design ? rendered.textBoxes : [];
  const activeTextBox = textBoxes.find(box => box.field === selectedText);
  const textField = selectedText || 'title';
  const rendering = rendered?.slide !== slide || rendered?.design !== design || rendered?.selected !== selected || rendered?.count !== slides.length;
  const locked = busy || uploading || generating || !ready;
  const canAddElement = !locked && (slide.stickers?.length || 0) < MAX_CAROUSEL_ELEMENTS;
  const canAddImage = canAddElement && (slide.stickers?.filter(item => item.kind === 'custom').length || 0) < MAX_CUSTOM_STICKERS;
  const revealPreview = () => { if (!window.matchMedia('(min-width: 1024px)').matches) requestAnimationFrame(() => document.getElementById('carousel-preview')?.scrollIntoView({ block: 'start', behavior: 'smooth' })); };
  const edit = useCallback((updates: Partial<CarouselSlide>) => setSlides(previous => previous.map((item, index) => index === selected ? { ...item, ...updates } : item), 'title' in updates || 'body' in updates ? `${slide.id}-${'title' in updates ? 'title' : 'body'}` : undefined), [selected, setSlides, slide.id]);
  const editTextFrame = (patch: CarouselTextFrame, field = textField) => {
    if (locked) return;
    setSelectedSticker(''); setSelectedText(field);
    const box = textBoxes.find(item => item.field === field), previous = slide.textFrames?.[field] || {};
    edit({ textFrames: { ...slide.textFrames, [field]: { ...(box ? { x: box.x / 1080 * 100, y: box.y / (design.format === 'square' ? 1080 : 1350) * 100 } : {}), ...previous, ...patch } } });
  };
  const resetTextFrame = (field = textField) => { const frames = { ...slide.textFrames }; delete frames[field]; edit({ textFrames: frames }); };
  const focusText = (field: CarouselTextField, range = { start: 0, end: slide[field].length }) => { setSelectedSticker(''); setSelectedText(field); setSidebar('text'); setTextSelection({ field, ...range, nonce: performance.now() }); };
  useEffect(() => {
    if (!libraryDrag) return;
    let frame = 0;
    const scroll = () => {
      const target = canvas.current;
      const inside = target && carouselDropPoint(target.getBoundingClientRect(), target.width, target.height, libraryDrag.x, libraryDrag.y);
      setDropHover(Boolean(inside));
      if (!inside) { const speed = libraryDrag.y < 90 ? -12 : libraryDrag.y > window.innerHeight - 75 ? 12 : 0; if (speed) window.scrollBy(0, speed); }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll); return () => cancelAnimationFrame(frame);
  }, [libraryDrag]);
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const draw = async () => {
      let boxes: CarouselTextBox[] = [];
      try {
        await ensureCarouselFonts(design, [slide]);
        const [image, logo, background, stickerImages] = await Promise.all([slide.image ? decodeLocalImage(slide.image) : null, design.logo ? decodeLocalImage(design.logo) : null, design.backgroundImage ? decodeLocalImage(design.backgroundImage) : null, loadStickerImages(slide.stickers)]);
        if (!cancelled && canvas.current) {
          const base = document.createElement('canvas'), foreground = document.createElement('canvas');
          renderCarouselSlide(base, slide, design, selected, slides.length, image, { logo, background, hideStickers: true, renderLayer: 'background' });
          const foregroundResult = renderCarouselSlide(foreground, slide, design, selected, slides.length, image, { logo, background, hideStickers: true, renderLayer: 'foreground' });
          boxes = foregroundResult.textBoxes; setFits(foregroundResult.fits);
          const target = canvas.current; target.width = base.width; target.height = base.height;
          const context = target.getContext('2d'); if (!context) return;
          const start = performance.now();
          const paint = () => {
            context.clearRect(0, 0, target.width, target.height); context.drawImage(base, 0, 0);
            const time = animate && !drag.current && !textDrag.current ? performance.now() - start : 0;
            drawSlideStickers(context, slide.stickers?.filter(sticker => sticker.layer === 'back'), target.width, target.height, time, stickerImages);
            context.drawImage(foreground, 0, 0);
            drawSlideStickers(context, slide.stickers?.filter(sticker => sticker.layer !== 'back'), target.width, target.height, time, stickerImages);
            const active = slide.stickers?.find(sticker => sticker.id === selectedSticker && !sticker.hidden);
            if (active) {
              const size = target.width * active.size / 100;
              context.save(); context.translate(target.width * active.x / 100, target.height * active.y / 100); context.rotate(active.rotation * Math.PI / 180);
              context.strokeStyle = '#7c3aed'; context.lineWidth = 3; context.setLineDash([8, 6]); context.strokeRect(-size / 2 - 8, -size / 2 - 8, size + 16, size + 16); context.restore();
            }
            const textBox = boxes.find(box => box.field === selectedText);
            if (textBox) { context.save(); context.translate(textBox.x, textBox.y); context.rotate(textBox.rotation * Math.PI / 180); context.strokeStyle = '#7c3aed'; context.lineWidth = 3; context.setLineDash([8, 6]); context.strokeRect(-textBox.width / 2 - 5, -textBox.height / 2 - 5, textBox.width + 10, textBox.height + 10); context.restore(); }
            context.save(); context.strokeStyle = '#ec4899'; context.lineWidth = 3; context.setLineDash([10, 6]);
            if (guides.x !== undefined) { context.beginPath(); context.moveTo(target.width * guides.x / 100, 0); context.lineTo(target.width * guides.x / 100, target.height); context.stroke(); }
            if (guides.y !== undefined) { context.beginPath(); context.moveTo(0, target.height * guides.y / 100); context.lineTo(target.width, target.height * guides.y / 100); context.stroke(); } context.restore();
            if (animate && slide.stickers?.some(isStickerAnimated)) frame = requestAnimationFrame(paint);
          };
          paint();
        }
      } catch (reason) { if (!cancelled) { setFits(false); setError(reason instanceof Error ? reason.message : 'Nie udało się odczytać obrazu.'); } }
      finally { if (!cancelled) setRendered({ slide, design, selected, count: slides.length, textBoxes: boxes }); }
    };
    void draw(); return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [slide, design, selected, slides.length, animate, selectedSticker, selectedText, guides]);
  useEffect(() => () => { uploadJob.current++; gifJob.current?.abort(); }, []);
  useEffect(() => {
    const finish = () => { drag.current = null; textDrag.current = null; setGuides(previous => previous.x !== undefined || previous.y !== undefined ? {} : previous); end(); };
    window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish);
    return () => { window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish); };
  }, [end]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (locked || assetLibrary || (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.closest('[role="dialog"], [data-carousel-element-add]')))) return;
      if (event.key === 'Escape') { if (!document.querySelector('[data-carousel-element-add][data-state="open"]')) { setSelectedSticker(''); setSelectedText(null); } return; }
      if (event.defaultPrevented) return;
      if (selectedText && activeTextBox && event.target === canvas.current && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault(); const step = event.shiftKey ? 10 : 1, height = design.format === 'square' ? 1080 : 1350;
        const center = clampTextCenter(activeTextBox, activeTextBox.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), activeTextBox.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0), 1080, height);
        edit({ textFrames: { ...slide.textFrames, [selectedText]: { ...slide.textFrames?.[selectedText], x: center.x / 1080 * 100, y: center.y / height * 100 } } }); return;
      }
      if (activeSticker && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); edit({ stickers: slide.stickers?.filter(item => item.id !== selectedSticker) }); setSelectedSticker(''); return; }
      if (activeSticker && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); const copy = duplicateCarouselSticker(slide.stickers || [], selectedSticker); if (copy) { edit({ stickers: [...(slide.stickers || []), copy] }); setSelectedSticker(copy.id); } return; }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y') { event.preventDefault(); if (event.shiftKey || event.key.toLowerCase() === 'y') redo(); else undo(); setSelectedSticker(''); }
    };
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [locked, undo, redo, assetLibrary, activeSticker, selectedSticker, slide.stickers, edit, selectedText, activeTextBox, design.format, slide.textFrames, setSelectedSticker]);

  const pointerPosition = (event: PointerEvent<HTMLCanvasElement>) => {
    const target = event.currentTarget, rect = target.getBoundingClientRect(), scale = Math.min(rect.width / target.width, rect.height / target.height);
    return { x: (event.clientX - rect.left - (rect.width - target.width * scale) / 2) / scale, y: (event.clientY - rect.top - (rect.height - target.height * scale) / 2) / scale };
  };
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (locked || rendering) return;
    const point = pointerPosition(event), target = event.currentTarget;
    target.focus({ preventScroll: true });
    const hitFront = [...(slide.stickers || [])].reverse().find(sticker => sticker.layer !== 'back' && !sticker.hidden && stickerHit(sticker, point.x, point.y, target.width, target.height));
    const textHit = !hitFront && [...textBoxes].reverse().find(box => carouselTextHit(box, point.x, point.y));
    const hit = hitFront || (!textHit && [...(slide.stickers || [])].reverse().find(sticker => sticker.layer === 'back' && !sticker.hidden && stickerHit(sticker, point.x, point.y, target.width, target.height)));
    setSelectedSticker(hit?.id || '');
    if (textHit) { setSelectedText(textHit.field); setSidebar('text'); event.preventDefault(); begin(); target.setPointerCapture(event.pointerId); textDrag.current = { field: textHit.field, box: textHit, dx: point.x - textHit.x, dy: point.y - textHit.y, clientX: event.clientX, clientY: event.clientY }; return; }
    setSelectedText(null);
    if (hit) { setSidebar('elements'); event.preventDefault(); if (!hit.locked) { begin(); target.setPointerCapture(event.pointerId); drag.current = { id: hit.id, dx: point.x - target.width * hit.x / 100, dy: point.y - target.height * hit.y / 100 }; } }
  };
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (textDrag.current && !locked) {
      const point = pointerPosition(event), target = event.currentTarget, active = textDrag.current;
      if (!active.moved && Math.hypot(event.clientX - active.clientX, event.clientY - active.clientY) < 3) return;
      active.moved = true;
      const raw = { x: (point.x - active.dx) / target.width * 100, y: (point.y - active.dy) / target.height * 100 };
      const position = snapping ? snapStickerPosition(raw.x, raw.y) : { ...raw, guideX: undefined, guideY: undefined };
      const center = clampTextCenter(active.box, position.x * target.width / 100, position.y * target.height / 100, target.width, target.height);
      setGuides({ x: position.guideX, y: position.guideY });
      edit({ textFrames: { ...slide.textFrames, [active.field]: { ...slide.textFrames?.[active.field], x: center.x / target.width * 100, y: center.y / target.height * 100 } } }); return;
    }
    if (!drag.current || locked) {
      if (!locked) { const point = pointerPosition(event); event.currentTarget.style.cursor = textBoxes.some(box => carouselTextHit(box, point.x, point.y)) ? 'move' : 'default'; }
      return;
    }
    const point = pointerPosition(event), target = event.currentTarget, active = drag.current;
    const x = (point.x - active.dx) / target.width * 100, y = (point.y - active.dy) / target.height * 100;
    const position = snapping ? snapStickerPosition(x, y, slide.stickers?.filter(sticker => sticker.id !== active.id)) : { x, y, guideX: undefined, guideY: undefined };
    setGuides({ x: position.guideX, y: position.guideY });
    edit({ stickers: slide.stickers?.map(sticker => sticker.id === active.id ? moveSticker(sticker, position.x, position.y) : sticker) });
  };

  const uploadSticker = async (file?: File, point = { x: 75, y: 75 }) => {
    if (!file || locked) return;
    if ((slide.stickers?.length || 0) >= MAX_CAROUSEL_ELEMENTS) { setError(`Na slajdzie może być maksymalnie ${MAX_CAROUSEL_ELEMENTS} elementów.`); return; }
    if ((slide.stickers?.filter(sticker => sticker.kind === 'custom').length || 0) >= MAX_CUSTOM_STICKERS) { setError(`Na slajdzie może być maksymalnie ${MAX_CUSTOM_STICKERS} własnych obrazów.`); return; }
    const id = slide.id, jobId = ++uploadJob.current; setUploading(true); setError('');
    try {
      const asset = await readStickerFile(file), sticker = { id: crypto.randomUUID(), kind: 'custom', asset, x: point.x, y: point.y, size: 22, rotation: 0, color: design.accent, motion: 'none' as const };
      if (uploadJob.current === jobId) { setSlides(previous => previous.map(item => item.id === id ? { ...item, stickers: [...(item.stickers || []), sticker] } : item)); setSelectedSticker(sticker.id); setSidebar('elements'); }
    } catch (reason) { if (uploadJob.current === jobId) setError(reason instanceof Error ? reason.message : 'Nie udało się dodać naklejki.'); }
    finally { if (uploadJob.current === jobId) setUploading(false); }
  };
  const addElement = (kind: string, point = { x: 76, y: 75 }) => {
    if (locked) return;
    if ((slide.stickers?.length || 0) >= MAX_CAROUSEL_ELEMENTS) { setNotice(`Limit ${MAX_CAROUSEL_ELEMENTS} elementów na slajdzie.`); return; }
    const position = snapping ? snapStickerPosition(point.x, point.y, slide.stickers) : point;
    const sticker = createCarouselSticker(kind, design.accent, position.x, position.y); if (!sticker) return;
    edit({ stickers: [...(slide.stickers || []), sticker] }); setSelectedSticker(sticker.id); setSidebar('elements'); setNotice(`Dodano: ${CAROUSEL_STICKERS.find(item => item.id === kind)?.name}. Możesz przeciągnąć element po slajdzie.`);
    requestAnimationFrame(() => { const target = canvas.current, rect = target?.getBoundingClientRect(); if (rect && (rect.top < 80 || rect.bottom > window.innerHeight)) document.getElementById('carousel-preview')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  };
  const cancelLibraryDrag = () => { setLibraryDrag(null); setDragKind(null); setDropHover(false); };
  const insertLibraryImage = async (item: CarouselLibraryImage, target: CarouselImageTarget, signal: AbortSignal) => {
    if (locked || (target === 'element' && !canAddImage)) throw new Error('Nie można teraz dodać obrazu. Sprawdź limit elementów na slajdzie.');
    const id = slide.id, job = ++uploadJob.current, owner = getStoredAuthSession()?.user?.id;
    setUploading(true); setError('');
    try {
      const data = await readCarouselLibraryImage(item, target, signal);
      if (owner !== getStoredAuthSession()?.user?.id) throw new Error('Konto się zmieniło. Otwórz bibliotekę ponownie.');
      if (target === 'element') await loadStickerAsset(data);
      if (signal.aborted) throw new DOMException('Wstawianie anulowane.', 'AbortError');
      if (job !== uploadJob.current) throw new Error('Wstawianie zostało anulowane.');
      if (target === 'background') setDesign(previous => ({ ...previous, background: 'photo', backgroundImage: data }));
      else if (target === 'photo') setSlides(previous => previous.map(item => item.id === id ? { ...item, image: data, imageSource: undefined } : item));
      else {
        const sticker = { id: crypto.randomUUID(), kind: 'custom', asset: { data, name: item.name.slice(0, 100) }, x: 50, y: 50, size: 36, rotation: 0, color: design.accent, motion: 'none' as const };
        setSlides(previous => previous.map(item => item.id === id ? { ...item, stickers: [...(item.stickers || []), sticker] } : item)); setSelectedSticker(sticker.id); setSidebar('elements');
      }
      setNotice(`Wstawiono: ${item.name}. Możesz cofnąć tę zmianę.`); revealPreview();
    } finally { if (job === uploadJob.current) setUploading(false); }
  };
  const insertEmoji = (emoji: string) => {
    if (!canAddElement) return;
    const sticker = createCarouselEmoji(emoji, design.accent); if (!sticker) return;
    edit({ stickers: [...(slide.stickers || []), sticker] }); setSelectedSticker(sticker.id); setSidebar('elements'); setNotice(`Dodano emoji ${emoji}. Przeciągnij je w wybrane miejsce.`); revealPreview();
  };
  const libraryHandlers: ElementDragHandlers = {
    onDragKind: kind => setDragKind(kind),
    onTouchMove: (kind, x, y) => { if (!locked) setLibraryDrag({ kind, x, y }); },
    onTouchDrop: (kind, x, y) => { const target = canvas.current, point = target && carouselDropPoint(target.getBoundingClientRect(), target.width, target.height, x, y); if (point) addElement(kind, point); },
    onDragCancel: cancelLibraryDrag,
  };
  const dropOnSlide = (event: DragEvent<HTMLCanvasElement>) => {
    event.preventDefault(); cancelLibraryDrag();
    if (locked) return;
    const target = event.currentTarget, point = carouselDropPoint(target.getBoundingClientRect(), target.width, target.height, event.clientX, event.clientY);
    if (!point) { setNotice('Upuść element w obrębie slajdu.'); return; }
    if (event.dataTransfer.files.length) { if (event.dataTransfer.files.length !== 1) { setNotice('Przeciągnij jeden obraz naraz.'); return; } void uploadSticker(event.dataTransfer.files[0], point); }
    else addElement(event.dataTransfer.getData(CAROUSEL_ELEMENT_MIME), point);
  };

  const upload = async (file?: File) => {
    if (!file) return;
    const id = slide.id, jobId = ++uploadJob.current;
    setUploading(true); setError('');
    try {
      const image = await readLocalDesignImage(file, 1600);
      if (uploadJob.current === jobId) setSlides(previous => previous.map(item => item.id === id ? { ...item, image: image.dataUrl, imageSource: undefined } : item));
    } catch (reason) { if (uploadJob.current === jobId) setError(reason instanceof Error ? reason.message : 'Nie udało się dodać zdjęcia.'); }
    finally { if (uploadJob.current === jobId) setUploading(false); }
  };
  const uploadBrandAsset = async (kind: 'logo' | 'backgroundImage', file?: File) => {
    if (!file) return;
    const jobId = ++uploadJob.current; setUploading(true); setError('');
    try {
      const image = await readLocalDesignImage(file, kind === 'logo' ? 800 : 1600);
      if (uploadJob.current === jobId) setDesign(previous => ({ ...previous, [kind]: image.dataUrl, ...(kind === 'backgroundImage' ? { background: 'photo' } : {}) }));
    } catch (reason) { if (uploadJob.current === jobId) setError(reason instanceof Error ? reason.message : 'Nie udało się dodać obrazu.'); }
    finally { if (uploadJob.current === jobId) setUploading(false); }
  };
  const saveProject = () => {
    try { saveLocalBlob(new Blob([serializeCarouselProject(slides, design)], { type: 'application/json' }), 'projekt-karuzeli.json'); setNotice('Projekt zapisany. Możesz później wczytać go wraz z logo i zdjęciami.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać projektu.'); }
  };
  const loadProject = async (file?: File) => {
    if (!file) return;
    const jobId = ++uploadJob.current; setUploading(true); setError('');
    try {
      if (file.size > 24_000_000) throw new Error('Projekt może mieć maksymalnie 24 MB.');
      const project = parseCarouselProject(await file.text());
      await validateCarouselAssets(project);
      if (uploadJob.current === jobId) { replace(project); setSelected(0); setSelectedSticker(''); setNotice('Projekt wczytany.'); }
    } catch (reason) { if (uploadJob.current === jobId) setError(reason instanceof Error ? reason.message : 'Nie udało się wczytać projektu.'); }
    finally { if (uploadJob.current === jobId) setUploading(false); }
  };
  const add = (duplicate = false) => {
    if (slides.length >= 10) return;
    const next = duplicate ? { ...slide, id: crypto.randomUUID() } : { id: crypto.randomUUID(), layout: 'content' as const, kicker: 'TWOJA WSKAZÓWKA', title: 'Nowy slajd', body: 'Wpisz treść, którą chcesz przekazać.', image: '' };
    setSlides(previous => [...previous.slice(0, selected + 1), next, ...previous.slice(selected + 1)]); setSelected(selected + 1); setNotice('Dodano slajd.');
  };
  const move = (direction: number) => {
    const target = selected + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides]; [next[selected], next[target]] = [next[target], next[selected]];
    setSlides(next); setSelected(target);
  };
  const exportSlides = async (kind: 'png' | 'zip' | 'pdf' | 'gif') => {
    if (locked || rendering) return;
    setBusy(true); setError(''); setNotice('Przygotowuję pliki…');
    try {
      await ensureCarouselFonts(design, slides);
      if (kind === 'gif') {
        const controller = new AbortController(); gifJob.current = controller; setExportingGif(true);
        const [image, logo, background, stickerImages] = await Promise.all([slide.image ? decodeLocalImage(slide.image) : null, design.logo ? decodeLocalImage(design.logo) : null, design.backgroundImage ? decodeLocalImage(design.backgroundImage) : null, loadStickerImages(slide.stickers)]);
        const base = document.createElement('canvas'), foreground = document.createElement('canvas');
        renderCarouselSlide(base, slide, design, selected, slides.length, image, { logo, background, hideStickers: true, renderLayer: 'background' });
        if (!renderCarouselSlide(foreground, slide, design, selected, slides.length, image, { logo, background, hideStickers: true, renderLayer: 'foreground' }).fits) throw new Error('Skróć tekst przed pobraniem.');
        const blob = await exportSlideGif(base, slide.stickers || [], controller.signal, (frame, total) => setNotice(`Tworzę GIF: ${frame}/${total} klatek…`), { images: stickerImages, foreground });
        saveLocalBlob(blob, `karuzela-${String(selected + 1).padStart(2, '0')}.gif`); setNotice('GIF jest gotowy do pobrania.'); return;
      }
      const indexes = kind === 'png' ? [selected] : slides.map((_, index) => index);
      const { default: JsPDF } = kind === 'pdf' ? await import('jspdf') : { default: null };
      const height = design.format === 'square' ? 1080 : 1350;
      const pdf = JsPDF ? new JsPDF({ unit: 'px', format: [1080, height], orientation: 'portrait', hotfixes: ['px_scaling'], compress: true }) : null;
      const files: Record<string, Uint8Array> = {};
      const [logo, background] = await Promise.all([design.logo ? decodeLocalImage(design.logo) : null, design.backgroundImage ? decodeLocalImage(design.backgroundImage) : null]);
      for (const [step, index] of indexes.entries()) {
        const current = slides[index], image = current.image ? await decodeLocalImage(current.image) : null;
        const target = document.createElement('canvas');
        const stickerImages = await loadStickerImages(current.stickers);
        const rendered = renderCarouselSlide(target, current, design, index, slides.length, image, { logo, background, stickerImages });
        if (!rendered.fits) throw new Error(`Slajd ${index + 1}: tekst jest zbyt długi. Skróć go przed pobraniem.`);
        setNotice(`Przygotowuję slajd ${step + 1} z ${indexes.length}…`);
        if (pdf) {
          if (step) pdf.addPage([1080, height], 'portrait');
          pdf.addImage(target.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, 1080, height);
        } else {
          const blob = await canvasPng(target);
          if (kind === 'png') saveLocalBlob(blob, `karuzela-${String(index + 1).padStart(2, '0')}.png`);
          else files[`slajd-${String(index + 1).padStart(2, '0')}.png`] = new Uint8Array(await blob.arrayBuffer());
        }
        target.width = 1; target.height = 1;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (pdf) pdf.save('karuzela.pdf');
      if (kind === 'zip') { const { zipSync } = await import('fflate'); saveLocalBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), 'karuzela-png.zip'); }
      setNotice('Plik jest gotowy do pobrania.');
    } catch (reason) { if (reason instanceof Error && reason.name === 'AbortError') { setNotice('Tworzenie GIF anulowane.'); } else { setNotice(''); setError(reason instanceof Error ? reason.message : 'Nie udało się przygotować pliku.'); } }
    finally { gifJob.current = null; setExportingGif(false); setBusy(false); }
  };
  const applyTemplate = async (includeSample: boolean) => {
    if (locked) return;
    const jobId = ++uploadJob.current;
    setBusy(true); setError('');
    try {
      const next = await prepareCarouselTemplate({ slides, design }, template, includeSample);
      if (uploadJob.current !== jobId) return;
      replace(next); setSelected(0); setSelectedSticker(''); setSelectedText(null);
      setNotice('Szablon zastosowany. Edytuj tekst i zdjęcie lub użyj „Cofnij”.');
      revealPreview();
    } catch (reason) {
      if (uploadJob.current === jobId) setError(reason instanceof Error ? reason.message : 'Nie udało się zastosować szablonu.');
    } finally { if (uploadJob.current === jobId) setBusy(false); }
  };
  const sidebarPanels = {
    navigation: <CarouselNavigationEditor value={design.navigation} onChange={navigation => setDesign(previous => ({ ...previous, navigation }))}/>,
    conversion: <CarouselConversionEditor slide={slide} design={design} slideNumber={selected + 1} slideCount={slides.length} onChange={(next, group) => { setSlides(previous => previous.map(item => item.id === slide.id ? next : item), group ? `${slide.id}-${group}` : undefined); setSelectedSticker(''); setSelectedText(null); setError(''); }} onReveal={revealPreview}/>,
    generator: <CarouselAiGenerator key={generatorAccess.userId || 'guest'} access={generatorAccess} disabled={locked} canAddImage={canAddImage} format={design.format} slideNumber={selected + 1} onBusyChange={setGenerating} onInsert={insertLibraryImage}/>,
    templates: <CarouselTemplateLibrary selected={template} onSelect={setTemplate} onApply={includeSample => void applyTemplate(includeSample)}/>,
    text: <>
<details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-semibold">Położenie, obrót i tło napisu</summary><div className="mt-3"><CarouselTextTransformEditor selected={textField} frame={slide.textFrames?.[textField] || {}} box={textBoxes.find(box => box.field === textField)} height={design.format === 'square' ? 1080 : 1350} onSelect={field => { setSelectedSticker(''); setSelectedText(field); }} onChange={editTextFrame} onReset={() => resetTextFrame()}/></div></details>
<p className="text-xs text-muted-foreground">Przeciągnij napis na slajdzie. Dwuklik na słowie zaznacza je w polu do edycji. Strzałki przesuwają zaznaczony napis (Shift: większy krok).</p>
<div className="space-y-2"><Label htmlFor="carousel-layout">Układ slajdu {selected + 1}</Label><select id="carousel-layout" value={slide.layout} onChange={event => edit({ layout: event.target.value as CarouselSlide['layout'] })} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="cover">Okładka / zakończenie</option><option value="content">Wskazówka</option><option value="quote">Cytat / ważna myśl</option></select></div>
          <CarouselTextEditor compact key={`${slide.id}-kicker`} id="carousel-kicker" label="Etykieta" value={slide.kicker} marks={slide.kickerMarks} maximum={40} onFocus={() => { setSelectedSticker(''); setSelectedText('kicker'); }} selection={textSelection?.field === 'kicker' ? textSelection : undefined} onChange={(kicker, kickerMarks) => edit({ kicker, kickerMarks })}/>
          <CarouselTextEditor compact key={`${slide.id}-title`} id="carousel-title" label="Nagłówek" value={slide.title} marks={slide.titleMarks} maximum={100} onFocus={() => { setSelectedSticker(''); setSelectedText('title'); }} selection={textSelection?.field === 'title' ? textSelection : undefined} onChange={(title, titleMarks) => edit({ title, titleMarks })}/>
          <CarouselTextEditor compact key={`${slide.id}-body`} id="carousel-body" label="Treść slajdu" value={slide.body} marks={slide.bodyMarks} maximum={500} onFocus={() => { setSelectedSticker(''); setSelectedText('body'); }} selection={textSelection?.field === 'body' ? textSelection : undefined} onChange={(body, bodyMarks) => edit({ body, bodyMarks })}/>
          <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">Czcionki i wielkość tekstu na wszystkich slajdach</summary><div className="mt-3 space-y-3">{(['title', 'body'] as const).map(field => <div key={field} className="space-y-2"><Label htmlFor={`carousel-${field}-font-global`}>{field === 'title' ? 'Czcionka nagłówków' : 'Czcionka treści'}</Label><select id={`carousel-${field}-font-global`} value={design[`${field}Font`] || 'theme'} onChange={event => setDesign(previous => ({ ...previous, [`${field}Font`]: event.target.value }))} className="h-10 w-full rounded border bg-background px-2 text-sm">{CAROUSEL_FONTS.map(font => <option key={font.id} value={font.id}>{font.name}</option>)}</select><Label htmlFor={`carousel-${field}-scale`}>Wielkość: {design[`${field}Scale`] || 100}%</Label><input id={`carousel-${field}-scale`} type="range" min="80" max="140" value={design[`${field}Scale`] || 100} onChange={event => setDesign(previous => ({ ...previous, [`${field}Scale`]: Number(event.target.value) }))} className="h-8 w-full accent-primary"/></div>)}</div></details>
    </>,
    elements: <>
<CarouselStickerEditor stickers={slide.stickers || []} selected={selectedSticker} accent={design.accent} onSelect={setSelectedSticker} onChange={stickers => edit({ stickers })} onUpload={file => void uploadSticker(file)} aspectRatio={design.format === 'square' ? 1 : .8} onAdd={kind => addElement(kind)} drag={libraryHandlers}/><label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox disabled={locked} checked={snapping} onCheckedChange={value => setSnapping(value === true)}/>Przyciągaj naklejki do środka i prowadnic</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={animate} onCheckedChange={value => setAnimate(value === true)}/>Animacje w podglądzie</label>
    </>,
    media: <>
<div className="grid gap-2">{([{ id: 'gallery', label: 'Moje wygenerowane grafiki', icon: ImagePlus }, { id: 'badges', label: 'Biblioteka badge’ów', icon: Award }, { id: 'emoji', label: 'Emoji i symbole', icon: Smile }, { id: 'icons', label: 'Ikony · wybierz kolor', icon: Shapes }] as const).map(({ id, label, icon: Icon }) => <Button key={id} variant="outline" className="h-11 justify-start gap-2" onClick={() => setAssetLibrary(id)}><Icon className="h-4 w-4"/>{label}</Button>)}</div>{slide.image && <div className="space-y-2"><Label htmlFor="carousel-image-frame">Ramka zdjęcia slajdu</Label><select id="carousel-image-frame" value={slide.imageFrame || (design.theme === 'newspaper' ? 'rectangle' : 'rounded')} onChange={event => edit({ imageFrame: event.target.value })} className="h-11 w-full rounded border bg-background px-3 text-sm">{CAROUSEL_IMAGE_FRAMES.map(frame => <option key={frame.id} value={frame.id}>{frame.name}</option>)}</select></div>}
          <div className="space-y-2"><Label htmlFor="carousel-image">Zdjęcie slajdu (opcjonalnie)</Label><input id="carousel-image" type="file" accept="image/png,image/jpeg,image/webp" className="w-full min-w-0 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:p-2" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} /><p className="text-xs text-muted-foreground">Do 12 MB. Ramka „Bez kadrowania” zachowuje całą postać i przezroczystość PNG.</p>{slide.image && <Button variant="outline" className="h-11 w-full" onClick={() => edit({ image: '', imageSource: undefined })}>Usuń zdjęcie</Button>}</div>
    </>,
    brand: <>
<div className="space-y-2"><Label htmlFor="carousel-brand">Nazwa marki / profil</Label><Input id="carousel-brand" value={design.brand} maxLength={42} onChange={event => setDesign(previous => ({ ...previous, brand: event.target.value }))} /></div>
          <details className="rounded-lg border p-3" open><summary className="cursor-pointer text-sm font-semibold">Logo marki na wszystkich slajdach</summary><div className="mt-3 space-y-3">
            <div className="space-y-2"><Label htmlFor="carousel-logo">Dodaj logo PNG, JPG lub WebP</Label><input id="carousel-logo" type="file" accept="image/png,image/jpeg,image/webp" className="w-full min-w-0 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:p-2" onChange={event => { void uploadBrandAsset('logo', event.target.files?.[0]); event.target.value = ''; }}/><p className="text-xs text-muted-foreground">Najlepiej PNG z przezroczystym tłem. Logo zachowuje proporcje.</p></div>
            {design.logo && <><img src={design.logo} alt="Logo marki" className="max-h-20 max-w-full rounded border bg-muted p-2 object-contain"/><div className="space-y-2"><Label htmlFor="carousel-brand-mode">Podpis marki</Label><select id="carousel-brand-mode" value={design.brandMode} onChange={event => setDesign(previous => ({ ...previous, brandMode: event.target.value as CarouselDesign['brandMode'] }))} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="both">Logo i nazwa marki</option><option value="logo">Samo logo zamiast nazwy</option><option value="text">Tylko nazwa marki</option></select></div><div className="space-y-2"><Label htmlFor="carousel-logo-size">Wielkość logo: {design.logoSize}</Label><input id="carousel-logo-size" type="range" min="32" max="90" value={design.logoSize} onChange={event => setDesign(previous => ({ ...previous, logoSize: Number(event.target.value) }))} className="h-8 w-full accent-primary"/></div><label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={design.logoPlate} onCheckedChange={value => setDesign(previous => ({ ...previous, logoPlate: value === true }))}/>Biała podkładka pod logo</label><Button variant="outline" className="h-11 w-full" onClick={() => setDesign(previous => ({ ...previous, logo: '' }))}>Usuń logo</Button></>}
          </div></details>
          <SvgColorInput id="carousel-accent" label="Kolor akcentu" value={design.accent} onChange={value => setDesign(previous => ({ ...previous, accent: value }))} />
    </>,
    background: <>
<div className="space-y-2 rounded-xl border p-3"><Label htmlFor="carousel-slide-tone">Tło tylko tego slajdu</Label><select id="carousel-slide-tone" value={slide.tone || 'theme'} onChange={event => edit({ tone: event.target.value as CarouselSlide['tone'] })} className="h-11 w-full rounded border bg-background px-2 text-sm">{CAROUSEL_TONES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="text-xs text-muted-foreground">Jasne, ciemne i kolorowe slajdy możesz przeplatać. Aby użyć tła ze zdjęciem lub wspólnego stylu, wybierz „Wspólne tło karuzeli”.</p></div>
<details className="rounded-lg border p-3" open><summary className="cursor-pointer text-sm font-semibold">Tło karuzeli</summary><div className="mt-3 space-y-3"><div className="space-y-2"><Label htmlFor="carousel-background">Rodzaj tła</Label><select id="carousel-background" value={design.background} onChange={event => setDesign(previous => ({ ...previous, background: event.target.value }))} className="h-11 w-full rounded-md border bg-background px-3 text-sm">{CAROUSEL_BACKGROUNDS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            {design.background === 'solid' && <SvgColorInput id="carousel-background-color" label="Kolor tła" value={design.backgroundColor || '#17142b'} onChange={value => setDesign(previous => ({ ...previous, backgroundColor: value }))}/>}
            {design.background === 'photo' && <><div className="space-y-2"><Label htmlFor="carousel-background-image">Zdjęcie tła</Label><input id="carousel-background-image" type="file" accept="image/png,image/jpeg,image/webp" className="w-full min-w-0 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:p-2" onChange={event => { void uploadBrandAsset('backgroundImage', event.target.files?.[0]); event.target.value = ''; }}/></div><div className="space-y-2"><Label htmlFor="carousel-background-shield">Osłona tła: {design.backgroundShield}%</Label><input id="carousel-background-shield" type="range" min="0" max="95" value={design.backgroundShield} onChange={event => setDesign(previous => ({ ...previous, backgroundShield: Number(event.target.value) }))} className="h-8 w-full accent-primary"/><p className="text-xs text-muted-foreground">Zwiększ osłonę, jeśli tekst jest słabo widoczny na zdjęciu.</p></div>{design.backgroundImage && <Button variant="outline" className="h-11 w-full" onClick={() => setDesign(previous => ({ ...previous, backgroundImage: '', background: 'theme' }))}>Usuń zdjęcie tła</Button>}</>}
          </div></details>
    </>,
    style: <>
<div className="space-y-2"><Label htmlFor="carousel-format">Format slajdów</Label><select id="carousel-format" value={design.format} onChange={event => setDesign(previous => ({ ...previous, format: event.target.value as CarouselDesign['format'] }))} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="portrait">Pionowy · 1080 × 1350</option><option value="square">Kwadrat · 1080 × 1080</option></select></div>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Styl karuzeli</legend><div className="grid grid-cols-2 gap-2">{CAROUSEL_THEMES.map(theme => <Button key={theme.id} className="h-11 gap-2 px-2" variant={design.theme === theme.id ? 'default' : 'outline'} aria-pressed={design.theme === theme.id} onClick={() => setDesign(previous => ({ ...previous, theme: theme.id, accent: theme.accent, backgroundColor: theme.background, background: 'theme' }))}><span className="h-4 w-4 shrink-0 rounded-full border" style={{ backgroundColor: theme.background, borderColor: theme.accent }} />{theme.name}</Button>)}</div></fieldset>
    </>,
    export: <>
<div className="grid gap-2">{(['png', 'zip', 'pdf'] as const).map(kind => <Button key={kind} disabled={locked || rendering || !fits} variant={kind === 'zip' ? 'default' : 'outline'} className="h-12 min-w-0 gap-2 px-2" onClick={() => void exportSlides(kind)}>{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}{kind === 'png' ? 'Ten slajd PNG' : kind === 'zip' ? 'Wszystkie PNG · ZIP' : 'Karuzela PDF'}</Button>)}</div>
        <Button disabled={locked || rendering || !fits || !slide.stickers?.some(isStickerAnimated)} variant="outline" className="h-12 w-full gap-2" onClick={() => void exportSlides('gif')}><Download className="h-4 w-4"/>Ten slajd GIF · animacja</Button>
        {exportingGif && <Button variant="outline" className="h-11 w-full" onClick={() => gifJob.current?.abort()}>Anuluj tworzenie GIF</Button>}
        <p className="text-xs text-muted-foreground">GIF: 540 px szerokości, pętla dopasowana do animacji (do 8 s). Dodaj naklejkę z animacją, aby go pobrać. PNG i PDF zapisują nieruchomą klatkę. Dostępność GIF zależy od miejsca publikacji.</p>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{uploading ? 'Wczytuję zdjęcie…' : notice}</p>
        <div className="grid gap-3 rounded-lg border p-3"><Button disabled={locked} variant="outline" className="h-11" onClick={saveProject}>Zapisz projekt</Button><div className="min-w-0 space-y-1"><Label htmlFor="carousel-project">Wczytaj projekt (JSON)</Label><input id="carousel-project" disabled={locked} type="file" accept="application/json,.json" className="w-full min-w-0 text-xs" onChange={event => { void loadProject(event.target.files?.[0]); event.target.value = ''; }}/></div></div>
        <p className="text-xs text-muted-foreground">Automatyczny zapis przywraca ostatni projekt w tej przeglądarce. Przycisk „Zapisz projekt” pobiera dodatkową kopię z logo, zdjęciami, naklejkami i formatowaniem. Wczytanie projektu zastępuje bieżącą karuzelę. Zdjęcia i logo pozostają w przeglądarce.</p>
    </>,
  };
  return <LocalSvgTool workspace title="Kreator karuzel" badge="Darmowa edycja · AI w płatnym pakiecie" description="Ułóż spójny zestaw slajdów. Edycja i pobieranie są darmowe. Generator AI jest dostępny w płatnym pakiecie i zużywa kredyty.">
    <div className="carousel-workspace" onPointerDownCapture={event => { if (event.target instanceof HTMLInputElement && event.target.type === 'range') begin(); }}>
      <div className="carousel-workspace-toolbar">
        <h1 className="mr-3 hidden shrink-0 text-lg font-bold lg:block">Kreator karuzel</h1>
        <Button disabled={locked || !editor.canUndo} variant="outline" size="sm" className="h-9 gap-1 px-2" onClick={() => { undo(); setSelectedSticker(''); setError(''); }} aria-label="Cofnij"><Undo2 className="h-4 w-4"/><span className="hidden sm:inline">Cofnij</span></Button>
        <Button disabled={locked || !editor.canRedo} variant="outline" size="sm" className="h-9 gap-1 px-2" onClick={() => { redo(); setSelectedSticker(''); setError(''); }} aria-label="Ponów"><Redo2 className="h-4 w-4"/><span className="hidden sm:inline">Ponów</span></Button>
        <p aria-live="polite" title={saveStatus} className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{saveStatus}</p>
        <Button variant="outline" className="h-9 gap-1 px-2" onClick={() => { setSidebar('export'); if (!window.matchMedia('(min-width: 1024px)').matches) document.getElementById('carousel-editor')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}><Download className="h-4 w-4"/>Pobierz</Button>
      </div>
      <div className="carousel-workspace-body">
        <CarouselWorkspaceSidebar active={sidebar} onChange={setSidebar} panels={sidebarPanels} disabled={locked} generatorLocked={!generatorAccess.data?.allowed}/>
        <section id="carousel-preview" className="carousel-workspace-preview scroll-mt-20" aria-label="Podgląd karuzeli">
<CarouselQuickElements color={design.accent} disabled={!canAddElement} drag={libraryHandlers} onChoose={kind => addElement(kind, { x: 50, y: 50 })} onLibrary={setAssetLibrary} libraryDisabled={locked} desktopCompact/>
<div ref={canvasStage} className="carousel-workspace-canvas relative"><canvas ref={canvas} tabIndex={0} onDoubleClick={event => { if (locked) return; const target = event.currentTarget, rect = target.getBoundingClientRect(), scale = Math.min(rect.width / target.width, rect.height / target.height); const point = { x: (event.clientX - rect.left - (rect.width - target.width * scale) / 2) / scale, y: (event.clientY - rect.top - (rect.height - target.height * scale) / 2) / scale }; if (slide.stickers?.some(item => item.layer !== 'back' && !item.hidden && stickerHit(item, point.x, point.y, target.width, target.height))) return; const box = [...textBoxes].reverse().find(box => carouselTextHit(box, point.x, point.y)); if (box) focusText(box.field, carouselWordAtPoint(slide[box.field], box, point.x, point.y) || { start: 0, end: slide[box.field].length }); }} role="img" aria-label={`Podgląd slajdu ${selected + 1}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; textDrag.current = null; }} onPointerCancel={() => { drag.current = null; textDrag.current = null; }} onLostPointerCapture={() => { drag.current = null; textDrag.current = null; }} onDragOver={event => { if (event.dataTransfer.types.includes(CAROUSEL_ELEMENT_MIME) || event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = locked ? 'none' : 'copy'; setDropHover(!locked); } }} onDragLeave={() => setDropHover(false)} onDrop={dropOnSlide} className={`mx-auto w-full touch-none rounded-lg object-contain ${dropHover ? 'ring-4 ring-primary ring-offset-2' : ''}`} />{activeTextBox && <CarouselTextToolbar canvas={canvas} stage={canvasStage} box={activeTextBox} frame={slide.textFrames?.[activeTextBox.field] || {}} height={design.format === 'square' ? 1080 : 1350} disabled={locked} onChange={patch => editTextFrame(patch, activeTextBox.field)} onEdit={() => focusText(activeTextBox.field)} onReset={() => resetTextFrame(activeTextBox.field)}/>}{activeSticker && <CarouselElementToolbar key={`${slide.id}-${activeSticker.id}`} canvas={canvas} stage={canvasStage} sticker={activeSticker} square={design.format === 'square'} disabled={locked} canAdd={canAddElement} canDuplicate={canDuplicateCarouselSticker(slide.stickers || [], selectedSticker)} onAdd={kind => addElement(kind, { x: activeSticker.x > 70 ? activeSticker.x - 14 : activeSticker.x + 14, y: activeSticker.y })} onLibrary={setAssetLibrary} onDuplicate={() => { const copy = duplicateCarouselSticker(slide.stickers || [], selectedSticker); if (copy && !locked) { edit({ stickers: [...(slide.stickers || []), copy] }); setSelectedSticker(copy.id); } }} onDelete={() => { if (!locked) { edit({ stickers: slide.stickers?.filter(item => item.id !== selectedSticker) }); setSelectedSticker(''); } }} onLayer={front => { if (!locked) edit({ stickers: reorderSticker((slide.stickers || []).map(item => item.id === selectedSticker ? { ...item, layer: front ? 'front' : 'back' } : item), selectedSticker, front) }); }} onEdit={updates => { if (!locked) edit({ stickers: slide.stickers?.map(item => item.id === selectedSticker ? { ...item, ...updates } : item) }); }}/>}</div>
          {!fits && <p role="alert" className="shrink-0 text-xs text-destructive">Tekst nie mieści się na tym slajdzie. Skróć go przed pobraniem.</p>}
          {error && <p role="alert" className="shrink-0 text-xs text-destructive">{error}</p>}
          <div className="carousel-workspace-filmstrip">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-1"><p className="text-xs text-muted-foreground">Slajd {selected + 1} z {slides.length}</p><div className="flex items-center gap-1">
              <Button disabled={locked || slides.length >= 10} variant="ghost" size="icon" className="h-8 w-8" onClick={() => add()} aria-label="Dodaj slajd" title="Dodaj slajd"><Plus className="h-4 w-4"/></Button>
              <Button disabled={locked || slides.length >= 10} variant="ghost" size="icon" className="h-8 w-8" onClick={() => add(true)} aria-label="Duplikuj slajd" title="Duplikuj slajd"><Copy className="h-4 w-4"/></Button>
              <Button disabled={locked || selected === 0} variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(-1)} aria-label="Przesuń slajd wcześniej" title="Przesuń slajd wcześniej"><ArrowUp className="h-4 w-4"/></Button>
              <Button disabled={locked || selected === slides.length - 1} variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(1)} aria-label="Przesuń slajd dalej" title="Przesuń slajd dalej"><ArrowDown className="h-4 w-4"/></Button>
              <Button disabled={locked || slides.length <= 1} variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSlides(previous => previous.filter((_, index) => index !== selected)); setSelected(Math.max(0, selected - 1)); }} aria-label="Usuń slajd" title="Usuń slajd"><Trash2 className="h-4 w-4"/></Button>
            </div></div>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="Wybór slajdu">{slides.map((item, index) => <Button key={item.id} disabled={locked} variant={selected === index ? 'default' : 'outline'} className="h-11 min-w-11 shrink-0 flex-col gap-0.5 px-2 py-1 text-[11px] lg:h-[56px] lg:w-12" aria-label={`Slajd ${index + 1}`} aria-pressed={selected === index} onClick={() => { setSelected(index); setSelectedSticker(''); setSelectedText(null); setError(''); }}><span className="hidden lg:block"><CarouselSlideThumbnail slide={item} design={design} index={index} count={slides.length}/></span>{index + 1}</Button>)}</div>
          </div>
          <p role="status" aria-live="polite" className="sr-only">{uploading ? 'Wczytuję grafikę…' : notice}</p>
          <Button asChild variant="outline" className="mt-2 h-11 w-full lg:hidden"><a href="#carousel-editor">Ustawienia i edycja ↓</a></Button>
        </section>
      </div>
    </div>
    {libraryDrag && <div aria-hidden="true" className="pointer-events-none fixed z-50 rounded-xl border bg-background/90 p-2 shadow-xl" style={{ left: libraryDrag.x - 32, top: libraryDrag.y - 45 }}><CarouselElementThumb kind={libraryDrag.kind} color={design.accent} className="h-16 w-16"/></div>}
    {assetLibrary && <CarouselAssetLibrary source={assetLibrary} onClose={() => setAssetLibrary(null)} onImage={insertLibraryImage} onEmoji={insertEmoji} canAddElement={(slide.stickers?.length || 0) < MAX_CAROUSEL_ELEMENTS} canAddImage={(slide.stickers?.length || 0) < MAX_CAROUSEL_ELEMENTS && (slide.stickers?.filter(item => item.kind === 'custom').length || 0) < MAX_CUSTOM_STICKERS}/>}
  </LocalSvgTool>;
}
