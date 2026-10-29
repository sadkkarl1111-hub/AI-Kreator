import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdPromptGenerator from './AdPromptGenerator';
import { vpsFetch } from '@/lib/vpsApi';
import { openAdGenerator } from '@/lib/adGeneratorHandoff';
const access = vi.hoisted(() => ({ userId: 'free-user', loading: false, refresh: vi.fn(async()=>{}), data: {campaign: {remaining:1,nextAvailableAt:null as string|null,limit:1,windowDays:7},research:{remaining:1,nextAvailableAt:null,limit:1,windowDays:7},lastSession:null as unknown} }));
vi.mock('@/lib/vpsApi', () => ({ vpsFetch: vi.fn() }));
vi.mock('@/components/AdCompetitorResearch', () => ({ AdCompetitorResearch: () => null }));
vi.mock('@/components/AdStudioImageGenerator', () => ({ AdStudioImageGenerator: () => null }));
vi.mock('@/lib/adGeneratorHandoff', () => ({ openAdGenerator: vi.fn() }));
vi.mock('@/hooks/useAdWeeklyAccess', () => ({ useAdWeeklyAccess: () => access }));
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const response = { ok: true, model: { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }, analysis: { offer: 'Automatyzacja faktur', audience: 'Małe firmy', campaignGoal: 'Umówienie rozmowy', concreteBenefits: ['Bez przepisywania danych'], missingInformation: [] }, prompts: [
  { styleId: 'impact', title: 'Mocny plakat', visualStyle: 'Mocny plakat', category: 'performance', hookPl: 'Faktury bez przepisywania', emphasisPl: 'bez przepisywania', colors: ['#020617', '#ffffff', '#f97316'], ctaPl: 'Umów rozmowę', benefitsPl: ['Dane w CRM'], prompt: 'first prompt', sceneConcept: 'Papier zmienia się w dane.', needsImage: false, imageNote: '' },
  { styleId: 'collage', title: 'Kolaż', visualStyle: 'Kolaż', category: 'creative', hookPl: 'Formularz wypełniony. CRM już wie.', ctaPl: 'Poznaj wdrożenie', prompt: 'second prompt', needsImage: true, imageNote: 'Dodaj zdjęcie właściciela firmy w generatorze.' },
] };
beforeEach(() => { access.data.campaign.remaining=1; access.data.campaign.nextAvailableAt=null; access.data.lastSession=null; vi.mocked(vpsFetch).mockImplementation(async (path) => path === '/me/profile' ? { purchases: [] } as never : response as never); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const start = async () => { render(<AdPromptGenerator />); return screen.findByRole('button', { name: 'Przygotuj reklamy' }); };
const generate = async () => { const submit = await start(); fireEvent.change(screen.getByLabelText('Co reklamujemy?'), { target: { value: 'Automatyzacja faktur' } }); fireEvent.click(submit); return screen.findByRole('region', { name: 'Propozycje reklam' }); };

it('starts with description or images, without style selection', async () => {
  const submit = await start(); expect(submit).toBeDisabled();
  expect(screen.queryByRole('group', { name: 'Filtruj propozycje' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Co reklamujemy?'), { target: { value: 'Oferta' } }); expect(submit).toBeEnabled();
});
it('renders copy cards, filters styles after generation and opens the chosen prompt separately', async () => {
  const results = await generate(); expect(within(results).getByRole('heading', { name: 'Faktury bez przepisywania' })).toBeVisible();
  expect(within(results).getByText('Prompty przygotował: GPT-5.6 Sol')).toBeVisible();
  expect(within(results).getByText('bez przepisywania')).toHaveStyle({ textDecorationLine: 'underline', textDecorationColor: '#f97316' });
  expect(within(results).getByText('Załącz zdjęcie: NIE')).toBeVisible();
  expect(within(results).getByText('Załącz zdjęcie: TAK')).toBeVisible();
  expect(within(results).getByText('Dodaj zdjęcie właściciela firmy w generatorze.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Kreatywne/ }));
  expect(screen.queryByRole('heading', { name: 'Faktury bez przepisywania' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Użyj tej reklamy' }));
  expect(openAdGenerator).toHaveBeenCalledWith('second prompt', 'illustration');
  expect(results).toBeInTheDocument();
});
it('does not show the confusing background/hero/effects section below the copy', async () => {
  const results = await generate();
  expect(within(results).queryByText('Tło, bohater i efekty')).not.toBeInTheDocument();
  expect(within(results).queryByText('Papier zmienia się w dane.')).not.toBeInTheDocument();
  expect(within(results).getByText(/Karty to podgląd tekstu, nie gotowe grafiki/)).toBeVisible();
  expect(within(results).getAllByText('Szczegóły i pełny prompt')).toHaveLength(2);
});
it('scenic directions are filtered after generation and pass their original prompt unchanged', async () => {
  const scenic = ['Dżungla', 'Basen', 'Góry', 'Budowa'].map((label, i) => ({ ...response.prompts[0], styleId: ['jungle', 'pool', 'mountains', 'worksite'][i], title: label, visualStyle: label, category: 'scenic', hookPl: 'Pomysł ' + label, prompt: 'Full scene prompt ' + label }));
  vi.mocked(vpsFetch).mockImplementation(async path => path === '/me/profile' ? { purchases: [] } as never : { ...response, prompts: [...response.prompts, ...scenic] } as never);
  const results = await generate();
  fireEvent.click(screen.getByRole('button', { name: /Sceniczne/ }));
  expect(within(results).queryByRole('heading', { name: 'Faktury bez przepisywania' })).not.toBeInTheDocument();
  for (const scene of scenic) expect(within(results).getByText(scene.hookPl)).toBeVisible();
  fireEvent.click(within(results).getAllByRole('button', { name: 'Użyj tej reklamy' })[0]);
  expect(openAdGenerator).toHaveBeenCalledWith('Full scene prompt Dżungla', 'realistic');
});
it('supports an image with no description', async () => {
  const submit = await start();
  fireEvent.change(screen.getByLabelText('Dodaj zdjęcia'), { target: { files: [new File(['image'], 'oferta.png', { type: 'image/png' })] } });
  await waitFor(() => expect(submit).toBeEnabled()); fireEvent.click(submit);
  await screen.findByRole('region', { name: 'Propozycje reklam' });
  const call = vi.mocked(vpsFetch).mock.calls.find(([path]) => path === '/ad-generator/generate')!;
  expect(JSON.parse(String(call[1]?.body))).toMatchObject({ text: '', images: [{ mediaType: 'image/png' }] });
});
it('failed subsequent generation keeps prior results and user input', async () => {
  await generate(); fireEvent.click(screen.getByRole('button', { name: /Twój opis i materiały/ }));
  vi.mocked(vpsFetch).mockRejectedValueOnce(new Error('Spróbuj ponownie'));
  fireEvent.click(screen.getByRole('button', { name: 'Przygotuj nowe propozycje' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Spróbuj ponownie');
  expect(screen.getByLabelText('Co reklamujemy?')).toHaveValue('Automatyzacja faktur');
  expect(screen.getByRole('heading', { name: 'Faktury bez przepisywania' })).toBeVisible();
});
it('cancel aborts the request without destroying the description', async () => {
  const submit = await start(); let signal: AbortSignal | null | undefined;
  vi.mocked(vpsFetch).mockImplementationOnce(async (_path, init) => {
    signal = init?.signal;
    return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  });
  fireEvent.change(screen.getByLabelText('Co reklamujemy?'), { target: { value: 'Oferta' } }); fireEvent.click(submit);
  fireEvent.click(await screen.findByRole('button', { name: 'Anuluj' }));
  await waitFor(() => expect(submit).toBeEnabled()); expect(signal?.aborted).toBe(true);
  expect(screen.getByLabelText('Co reklamujemy?')).toHaveValue('Oferta'); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('opens for a paid account without administrator privileges', async () => {

  vi.mocked(vpsFetch).mockImplementation(async path => path === '/me/profile' ? { purchases: [{ status: 'completed' }] } as never : response as never);
  const submit = await start();
  fireEvent.change(screen.getByLabelText('Co reklamujemy?'), { target: { value: 'Oferta dla klientów' } });
  expect(submit).toBeEnabled();
});
it('allows a free account to prepare one weekly set', async () => {
  const submit=await start(); fireEvent.change(screen.getByLabelText('Co reklamujemy?'),{target:{value:'Oferta'}});
  expect(submit).toBeEnabled(); expect(screen.getByText(/1 zestaw co 7 dni/)).toBeVisible();
});
it('disables generation after the weekly quota is exhausted and restores saved prompts', async () => {
  access.data.campaign.remaining=0; access.data.campaign.nextAvailableAt='2026-11-01T12:00:00Z';
  access.data.lastSession={id:'saved',inputText:'Zapisana oferta',prompts:response.prompts,createdAt:'2026-10-25T12:00:00Z'};
  render(<AdPromptGenerator/>);
  expect(await screen.findByRole('heading',{name:'Faktury bez przepisywania'})).toBeVisible();
  expect(screen.getByText(/Następne generowanie/)).toBeVisible();
  expect(vi.mocked(vpsFetch).mock.calls.filter(([path])=>path==='/ad-generator/generate')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:/Twój opis i materiały/}));
  expect(screen.getByRole('button',{name:'Przygotuj nowe propozycje'})).toBeDisabled();
});
