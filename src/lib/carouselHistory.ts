import type { CarouselDesign, CarouselSlide } from './carouselDesign';
export type CarouselDocument = { slides: CarouselSlide[]; design: CarouselDesign };
export type CarouselHistory = { past: CarouselDocument[]; present: CarouselDocument; future: CarouselDocument[]; group?: string; time: number; transaction: boolean; changed: boolean };
export type CarouselHistoryAction = { type: 'change'; update: (value: CarouselDocument) => CarouselDocument; group?: string; time: number } | { type: 'restore'; value: CarouselDocument } | { type: 'undo' | 'redo' | 'begin' | 'end' };
export const createCarouselHistory = (present: CarouselDocument): CarouselHistory => ({ past: [], present, future: [], time: 0, transaction: false, changed: false });
export function carouselHistoryReducer(state: CarouselHistory, action: CarouselHistoryAction): CarouselHistory {
  if (action.type === 'restore') return createCarouselHistory(action.value);
  if (action.type === 'begin') return { ...state, transaction: true, changed: false, group: undefined };
  if (action.type === 'end') return state.transaction || state.group ? { ...state, transaction: false, changed: false, group: undefined } : state;
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return { ...createCarouselHistory(state.past[state.past.length - 1]), past: state.past.slice(0, -1), future: [state.present, ...state.future].slice(0, 40) };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return { ...createCarouselHistory(state.future[0]), past: [...state.past, state.present].slice(-40), future: state.future.slice(1) };
  }
  if (action.type !== 'change') return state;
  const next = action.update(state.present);
  if (next === state.present || (next.slides === state.present.slides && next.design === state.present.design)) return state;
  const merge = state.transaction ? state.changed : Boolean(action.group && state.group === action.group && action.time - state.time < 650);
  return { ...state, present: next, past: merge ? state.past : [...state.past, state.present].slice(-40), future: [], group: action.group, time: action.time, changed: state.transaction };
}
