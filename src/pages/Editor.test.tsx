import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import Editor from './Editor';

const mocks = vi.hoisted(() => ({ user: { id: 'test-user' }, fetch: vi.fn(), models: [{ id: 'test-model', label: 'Test', cost: 60 }] }));
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/ui/slider', () => ({ Slider: () => <div /> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: true }) }));
vi.mock('@/hooks/useCredits', () => ({ useCredits: () => ({ balance: 1000, loading: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/useAiModels', () => ({ useAiModels: () => ({ aiModels: mocks.models, loading: false, selectedModel: 'test-model', selectedModelOption: mocks.models[0], setSelectedModel: vi.fn() }) }));
vi.mock('@/lib/vpsApi', () => ({ vpsFetch: mocks.fetch }));
vi.mock('@/lib/toolImage', () => ({
  loadImageFromUrlAsDataUrl: async () => ({ dataUrl: 'data:image/png;base64,c291cmNl', mimeType: 'image/png' }),
  readImageFile: async () => ({ dataUrl: 'data:image/png;base64,c291cmNl', mimeType: 'image/png' }),
}));

beforeEach(() => {
  mocks.fetch.mockReset().mockImplementation(async (path: string) => path === '/ai/edit-image' ? { imageUrl: '/result.png' } : { badges: [] });
  vi.stubGlobal('Image', class { naturalWidth = 100; naturalHeight = 100; onload: (() => void) | null = null; set src(_value: string) { queueMicrotask(() => this.onload?.()); } });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 100, left: 0, top: 0 } as DOMRect);
  const pixels = new Uint8ClampedArray(4);
  const context = {
    drawImage: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    fill: () => { pixels[3] = 100; }, stroke: () => { pixels[3] = 100; },
    clearRect: () => pixels.fill(0), fillRect: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(pixels) }), putImageData: (snapshot: ImageData) => pixels.set(snapshot.data),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,bWFzaw==');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function openBadge() {
  render(<MemoryRouter initialEntries={['/tools/badge-editor?badge=illustrated-v1-live-pencil']}><Editor mode="badge" /></MemoryRouter>);
  await screen.findByAltText('Oryginalny badge');
  return screen.getByLabelText('Opisz zmianę');
}

it('offers one description and Edit without a selection canvas or separate action forms', async () => {
  const input = await openBadge(), submit = screen.getByRole('button', { name: 'Edytuj (60 kr)' });
  expect(submit).toBeDisabled();
  expect(document.querySelector('canvas')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Cofnij' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Stary napis')).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: 'Zmień żółty kolor na zielony' } });
  expect(submit).toBeEnabled();
});

it.each(['Zmień żółty kolor na zielony', 'Zmień napis NA ŻYWO na LIVE'])('sends the original and the free-form instruction without a mask: %s', async prompt => {
  const input = await openBadge();
  fireEvent.change(input, { target: { value: prompt } });
  fireEvent.click(screen.getByRole('button', { name: 'Edytuj (60 kr)' }));
  await screen.findByRole('button', { name: 'Edytuj dalej' });
  const request = JSON.parse(mocks.fetch.mock.calls.find(([path]) => path === '/ai/edit-image')![1].body);
  expect(request.imageBase64).toBe('c291cmNl'); expect(request.prompt).toBe(prompt);
  expect(request).not.toHaveProperty('maskBase64');
  expect(request.badgeEdit).toEqual({ action: 'describe' });
});

it('retains optional selection and complete undo in the general image editor', async () => {
  const { container } = render(<MemoryRouter><Editor /></MemoryRouter>);
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['image'], 'source.png', { type: 'image/png' })] } });
  const canvas = await screen.findByLabelText('Zaznaczenie obszaru do edycji');
  fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 }); fireEvent.mouseUp(canvas);
  expect(screen.getByRole('button', { name: 'Wyczysc' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cofnij' }));
  expect(screen.getByRole('button', { name: 'Wyczysc' })).toBeDisabled();
});
