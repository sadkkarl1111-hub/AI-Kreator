import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminBadges } from './AdminBadges';
import { BADGE_CATALOG } from '@/lib/badgeCatalog';
import { newestBadgesFirst } from '@/lib/badgeLibraryView';
import { vpsFetch } from '@/lib/vpsApi';
vi.mock('@/lib/vpsApi', () => ({ vpsFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('lists the entire real catalog with latest releases first, retaining admin visibility controls', async () => {
  vi.mocked(vpsFetch).mockResolvedValue({ ok: true, badges: [], hiddenKeys: ['premium-guarantee-90-burgundy'], packages: [], access: [] });
  const { container } = render(<AdminBadges/>);
  const image = await screen.findByAltText('Gwarancja zwrotu 90 dni — bordo');
  const images = container.querySelectorAll('img');
  expect(images).toHaveLength(BADGE_CATALOG.length);
  expect(images[0]).toHaveAttribute('alt', newestBadgesFirst(BADGE_CATALOG)[0].name);
  const card = image.parentElement!.parentElement!;
  expect(within(card).getByText('Ukryty')).toBeInTheDocument();
  expect(within(card).getByRole('button', { name: 'Przywróć' })).toBeEnabled();
  expect(screen.getByLabelText('Pakiety dostępu: Zapisz się na webinar — koralowy bilet')).toBeEnabled();
  expect(vpsFetch).toHaveBeenCalledTimes(1);
}, 15000); // Renders the complete asset catalog, including package controls.
