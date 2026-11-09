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

async function uploadProduct(adMode = false) {
  const { container } = render(<MemoryRouter><BackgroundReplace productMode adMode={adMode} /></MemoryRouter>);
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

it('reserves ad copy space opposite the product and sends the selected aspect format', async () => {
  mocks.fetch.mockResolvedValue({ imageUrl: '/ad.png' });
  await uploadProduct(true);
  fireEvent.change(screen.getByLabelText('Miejsce na tekst'), { target: { value: 'right' } });
  fireEvent.change(screen.getByLabelText('Format reklamy'), { target: { value: '1024x1024' } });
  fireEvent.click(screen.getByRole('button', { name: 'Wygeneruj zdjęcie reklamowe' }));
  await screen.findByAltText('Gotowe zdjęcie produktowe');
  const request = JSON.parse(mocks.fetch.mock.calls[0][1].body);
  expect(request).toMatchObject({ toolId: 'ad-photo', dimensions: '1024x1024', expectedCreditCost: 60 });
  expect(request.prompt).toContain('entire product within the left half');
  expect(request.prompt).toContain('Reserve the right 45%');
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

it('keeps completed shots and retries only the remaining shots after a partial failure', async () => {
  mocks.fetch
    .mockResolvedValueOnce({ imageUrl: '/angle.png' })
    .mockRejectedValueOnce(new Error('Model unavailable'))
    .mockResolvedValueOnce({ imageUrl: '/top.png' });
  await uploadProduct();
  fireEvent.click(screen.getByLabelText('Seria ujęć'));
  fireEvent.click(screen.getByRole('button', { name: 'Z góry' }));
  fireEvent.change(screen.getByLabelText('Format zdjęcia'), { target: { value: '1024x1536' } });
  expect(screen.getByText('120 kr')).toBeInTheDocument();
  const generate = screen.getByRole('button', { name: 'Wygeneruj wybrane ujęcia' });
  fireEvent.click(generate);
  await screen.findByText(/Gotowe ujęcia w tej próbie: 1 z 2/);
  await waitFor(() => expect(generate).toBeEnabled());
  expect(screen.getByAltText('Gotowe zdjęcie produktowe')).toHaveAttribute('src', '/angle.png');
  fireEvent.click(generate);
  await screen.findByRole('button', { name: 'Pobierz serię ZIP' });
  expect(screen.getByAltText('Zdjęcie produktowe: Pod kątem 45°')).toHaveAttribute('src', '/angle.png');
  expect(screen.getByAltText('Zdjęcie produktowe: Z góry')).toHaveAttribute('src', '/top.png');
  const requests = mocks.fetch.mock.calls.map(([, options]) => JSON.parse(options.body));
  expect(requests).toHaveLength(3);
  expect(requests[0].prompt).toContain('rotated approximately 45 degrees');
  expect(requests[1]).toEqual(requests[2]);
  expect(requests[2]).toMatchObject({ dimensions: '1024x1536', expectedCreditCost: 60 });
});
