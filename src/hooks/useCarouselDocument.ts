import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type SetStateAction } from 'react';
import { carouselHistoryReducer, createCarouselHistory, type CarouselDocument } from '@/lib/carouselHistory';
import { defaultCarouselDesign, initialCarouselSlides, type CarouselDesign, type CarouselSlide } from '@/lib/carouselDesign';
import { parseCarouselProject } from '@/lib/carouselProject';
import { prepareCarouselDraft, pruneCarouselDraftAssets, readCarouselDraft, writeCarouselDraft, writeCarouselRecovery } from '@/lib/carouselDraft';
import { validateCarouselAssets } from '@/lib/carouselStickerAssets';

export function useCarouselDocument() {
  const [history, dispatch] = useReducer(carouselHistoryReducer, undefined, () => createCarouselHistory({ slides: initialCarouselSlides.map(slide => ({ ...slide, id: crypto.randomUUID() })), design: { ...defaultCarouselDesign } }));
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Sprawdzam zapisany projekt…');
  const skipFirst = useRef(true);
  const flush = useRef<(() => void) | null>(null);
  useEffect(() => () => { flush.current?.(); }, []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const source = await readCarouselDraft();
        if (source) { const project = parseCarouselProject(source); await validateCarouselAssets(project); if (!cancelled) { await pruneCarouselDraftAssets(project); if (!cancelled) { dispatch({ type: 'restore', value: project }); setSaveStatus('Przywrócono projekt zapisany na tym urządzeniu.'); } } }
        else if (!cancelled) setSaveStatus('Automatyczny zapis na tym urządzeniu jest włączony.');
      } catch { if (!cancelled) setSaveStatus('Nie udało się odczytać automatycznego zapisu. Korzystaj z przycisku „Zapisz projekt”.'); }
      finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
  }, []);
  useLayoutEffect(() => {
    if (!ready) return;
    if (skipFirst.current) { skipFirst.current = false; return; }
    let cancelled = false, saved = false;
    let pending: ReturnType<typeof prepareCarouselDraft>;
    try { pending = prepareCarouselDraft(history.present); writeCarouselRecovery(pending.journal); queueMicrotask(() => { if (!cancelled) setSaveStatus('Zapisuję zmiany na tym urządzeniu…'); }); }
    catch { queueMicrotask(() => { if (!cancelled) setSaveStatus('Projekt jest za duży do automatycznego zapisu. Zmniejsz liczbę zdjęć.'); }); return () => { cancelled = true; }; }
    const save = () => {
      if (saved) return; saved = true;
      void writeCarouselDraft(pending).then(() => { if (!cancelled) setSaveStatus(`Automatycznie zapisano lokalnie o ${new Date().toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })}.`); }).catch(() => { if (!cancelled) setSaveStatus('Brak miejsca na automatyczny zapis. Pobierz projekt przyciskiem „Zapisz projekt”.'); });
    };
    save();
    flush.current = save;
    const leaving = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', leaving); window.addEventListener('pagehide', save);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', leaving); window.removeEventListener('pagehide', save); };
  }, [history.present, ready]);
  const setSlides = useCallback((value: SetStateAction<CarouselSlide[]>, group?: string) => dispatch({ type: 'change', time: Date.now(), group, update: project => ({ ...project, slides: typeof value === 'function' ? value(project.slides) : value }) }), []);
  const setDesign = useCallback((value: SetStateAction<CarouselDesign>) => dispatch({ type: 'change', time: Date.now(), group: 'design', update: project => ({ ...project, design: typeof value === 'function' ? value(project.design) : value }) }), []);
  const replace = useCallback((value: CarouselDocument) => dispatch({ type: 'change', time: Date.now(), update: () => value }), []);
  return { ...history.present, setSlides, setDesign, replace, ready, saveStatus, canUndo: history.past.length > 0, canRedo: history.future.length > 0, undo: useCallback(() => dispatch({ type: 'undo' }), []), redo: useCallback(() => dispatch({ type: 'redo' }), []), begin: useCallback(() => dispatch({ type: 'begin' }), []), end: useCallback(() => dispatch({ type: 'end' }), []) };
}
