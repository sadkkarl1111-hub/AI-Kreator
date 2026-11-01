import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import Editor from './Editor';

const mocks = vi.hoisted(() => ({
  user: { id: 'test-user' },
  fetch: vi.fn(),
  models: [{ id: 'test-model', label: 'Test', cost: 60 }],
}));
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/ui/slider', () => ({ Slider: () => <div /> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: true }) }));
vi.mock('@/hooks/useCredits', () => ({ useCredits: () => ({ balance: 1000, loading: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/useAiModels', () => ({ useAiModels: () => ({ aiModels: mocks.models, loading: false, selectedModel: 'test-model', selectedModelOption: mocks.models[0], setSelectedModel: vi.fn() }) }));
vi.mock('@/lib/vpsApi', () => ({ vpsFetch: mocks.fetch }));
vi.mock('@/lib/toolImage', () => ({ loadImageFromUrlAsDataUrl: async () => ({ dataUrl: 'data:image/png;base64,c291cmNl', mimeType: 'image/png' }) }));

beforeEach(() => {
  mocks.fetch.mockReset().mockImplementation(async (path: string) => path === '/ai/edit-image' ? { imageUrl: '/result.png' } : { badges: [] });
  vi.stubGlobal('Image', class {
    naturalWidth = 100;
    naturalHeight = 100;
    onload: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 100, left: 0, top: 0 } as DOMRect);
  // A canvas snapshot must be captured before painting. React may defer a state
  // updater until after the paint, which previously left the first dot on undo.
  const pixels = new Uint8ClampedArray(4);
  const context = {
    drawImage: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    fill: () => { pixels[3] = 100; }, stroke: () => { pixels[3] = 100; },
    clearRect: () => pixels.fill(0), fillRect: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(pixels) }),
    putImageData: (snapshot: ImageData) => pixels.set(snapshot.data),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,bWFzaw==');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function open() {
  render(<MemoryRouter initialEntries={['/tools/badge-editor?badge=illustrated-v1-live-pencil']}><Editor mode="badge" /></MemoryRouter>);
  return screen.findByLabelText('Zaznaczenie obszaru do edycji');
}
function mark(canvas: HTMLElement) {
  fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
  fireEvent.mouseUp(canvas);
}

it('undoing the first stroke clears the entire selection and blocks a paid edit', async () => {
  const canvas = await open();
  fireEvent.change(screen.getByLabelText('Stary napis'), { target: { value: 'NA ŻYWO' } });
  fireEvent.change(screen.getByLabelText('Nowy napis'), { target: { value: 'LIVE' } });
  const submit = screen.getByRole('button', { name: 'Zmień napis (60 kr)' });
  expect(submit).toBeDisabled();
  mark(canvas); expect(submit).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cofnij' }));
  expect(submit).toBeDisabled();
  expect(mocks.fetch.mock.calls.some(([path]) => path === '/ai/edit-image')).toBe(false);
});

it('sends the exact text replacement with the original and a required selection', async () => {
  const canvas = await open();
  fireEvent.change(screen.getByLabelText('Stary napis'), { target: { value: 'NA ŻYWO' } });
  fireEvent.change(screen.getByLabelText('Nowy napis'), { target: { value: 'LIVE' } });
  mark(canvas);
  fireEvent.click(screen.getByRole('button', { name: 'Zmień napis (60 kr)' }));
  await screen.findByRole('button', { name: 'Edytuj dalej' });
  const request = JSON.parse(mocks.fetch.mock.calls.find(([path]) => path === '/ai/edit-image')![1].body);
  expect(request.imageBase64).toBe('c291cmNl'); expect(request.maskBase64).toBe('bWFzaw==');
  expect(request.badgeEdit).toMatchObject({ action: 'replace-text', oldText: 'NA ŻYWO', newText: 'LIVE' });
});

it('requires a color and target and sends a separate color operation', async () => {
  const canvas = await open();
  fireEvent.click(screen.getByRole('button', { name: 'Zmień kolor' }));
  mark(canvas);
  const submit = screen.getByRole('button', { name: 'Zmień kolor (60 kr)' });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Co przemalować?'), { target: { value: 'nagłówek' } });
  fireEvent.change(screen.getByLabelText('Nowy kolor'), { target: { value: '#2048A0' } });
  fireEvent.click(submit);
  await screen.findByRole('button', { name: 'Edytuj dalej' });
  const request = JSON.parse(mocks.fetch.mock.calls.find(([path]) => path === '/ai/edit-image')![1].body);
  expect(request.badgeEdit).toMatchObject({ action: 'change-color', target: 'nagłówek', color: '#2048A0' });
});
