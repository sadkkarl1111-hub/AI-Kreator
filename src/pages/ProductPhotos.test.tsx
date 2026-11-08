import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackgroundReplace from './BackgroundReplace';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), balance: 200, refetch: vi.fn() }));
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/hooks/useCredits', () => ({ useCredits: () => ({ balance: mocks.balance, loading: false, refetch: mocks.refetch }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false }) }));
vi.mock('@/hooks/useToolPricing', () => ({ useToolPricing: () => ({ cost: 1 }) }));
vi.mock('@/hooks/useAiModels', () => ({ useAiModels: () => ({ aiModels: [{ id: 'editing-model', label: 'Studio', cost: 60 }], selectedModel: 'editing-model', selectedModelOption: { cost: 60 }, setSelectedModel: vi.fn() }) }));
vi.mock('@/lib/vpsApi', () => ({ vpsFetch: mocks.fetch }));
vi.mock('@/lib/toolImage', () => ({
  readImageFile: async () => ({ dataUrl: 'data:image/png;base64,c291cmNl', base64: 'c291cmNl', mimeType: 'image/png' }),
  loadUserGalleryImages: vi.fn(), loadImageFromUrlAsDataUrl: vi.fn(),
}));
afterEach(() => { cleanup(); mocks.fetch.mockReset(); mocks.refetch.mockReset(); mocks.balance = 200; });

async function uploadProduct() {
  const { container } = render(<MemoryRouter><BackgroundReplace productMode /></MemoryRouter>);
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['product'], 'product.png', { type: 'image/png' })] } });
  await screen.findByAltText('Źródło');
}

it('sends the product reference and selected scene, uses model pricing and displays the result', async () => {
  mocks.fetch.mockResolvedValue({ imageUrl: '/product-result.png' });
  await uploadProduct();
  expect(screen.getByText('60 kr')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Marmur' }));
  fireEvent.click(screen.getByRole('button', { name: 'Na leżąco' }));
  fireEvent.click(screen.getByRole('button', { name: 'Wygeneruj zdjęcie produktowe' }));
  await screen.findByAltText('Gotowe zdjęcie produktowe');
  const [endpoint, options] = mocks.fetch.mock.calls[0];
  const body = JSON.parse(options.body);
  expect(endpoint).toBe('/ai/edit-image');
  expect(body).toMatchObject({ imageBase64: 'c291cmNl', imageMimeType: 'image/png', model: 'editing-model', toolId: 'product-photos' });
  expect(body.prompt).toContain('marble tabletop');
  expect(body.prompt).toContain('all existing label text');
  expect(body.prompt).toContain('Lay the product horizontally');
  expect(body.prompt).toContain('Do not merely paste the original cutout');
  expect(mocks.refetch).toHaveBeenCalledOnce();
});

it('blocks generation when balance is below the model cost even if tool pricing is lower', async () => {
  mocks.balance = 10;
  await uploadProduct();
  fireEvent.click(screen.getByRole('button', { name: 'Wygeneruj zdjęcie produktowe' }));
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('allows retry after an unsuccessful generation without showing a result', async () => {
  mocks.fetch.mockRejectedValue(new Error('Generation failed'));
  await uploadProduct();
  fireEvent.click(screen.getByRole('button', { name: 'Wygeneruj zdjęcie produktowe' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Wygeneruj zdjęcie produktowe' })).toBeEnabled());
  expect(screen.queryByAltText('Gotowe zdjęcie produktowe')).not.toBeInTheDocument();
});
