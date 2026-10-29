import { beforeEach, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({
  hidden: vi.fn(), badges: vi.fn(), access: vi.fn(), packages: vi.fn(), purchases: vi.fn(), authenticate: vi.fn(),
}));
vi.mock('../../vps/server/src/lib/localAdminAssetsData.js', () => ({
  listLocalHiddenStaticBadges: data.hidden, listLocalAdminBadges: data.badges,
  listLocalBadgePackageAccess: data.access,
  listLocalAdminEmojis: vi.fn(), listLocalEmojiCategories: vi.fn(),
  listLocalFavoriteEmojis: vi.fn(), setLocalFavoriteEmoji: vi.fn(),
}));
vi.mock('../../vps/server/src/lib/localBillingData.js', () => ({
  listLocalCreditPackages: data.packages, listLocalCreditPurchases: data.purchases,
}));
vi.mock('../../vps/server/src/lib/badgeFiles.js', () => ({ getBadgePublicUrl: vi.fn() }));
vi.mock('../../vps/server/src/middleware/requireAuthenticatedUser.js', () => ({ requireAuthenticatedUser: data.authenticate }));
import { assetsRouter } from '../../vps/server/src/routes/assets';

const route = assetsRouter.stack.find(layer => layer.route?.path === '/assets/badges/library')!.route!;
const response = () => ({ setHeader: vi.fn(), json: vi.fn(), status: vi.fn().mockReturnThis() });

beforeEach(() => {
  vi.resetAllMocks();
  data.hidden.mockResolvedValue([{ badge_key: 'hidden' }]);
  data.badges.mockResolvedValue([]);
  data.access.mockResolvedValue([{ badge_key: 'paid', package_id: 'premium' }]);
  data.packages.mockResolvedValue([{ id: 'premium', label: 'Premium', credits: 100, price_grosze: 1000 }]);
  data.purchases.mockResolvedValue([{ credits: 100, amount: 1000 }]);
});

it('gives guests current visibility and restrictions without querying user purchases', async () => {
  const res = response();
  const next = vi.fn();
  const req = { header: () => undefined };
  await route.stack[0].handle(req as never, res as never, next);
  expect(next).toHaveBeenCalled();
  expect(data.authenticate).not.toHaveBeenCalled();
  await route.stack[1].handle(req as never, res as never, next);
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    hiddenKeys: ['hidden'], access: [{ badge_key: 'paid', package_id: 'premium' }], purchasedPackageIds: [],
  }));
  expect(data.purchases).not.toHaveBeenCalled();
});

it('still validates supplied authorization tokens', async () => {
  const req = { header: () => 'Bearer invalid' };
  const res = response();
  const next = vi.fn();
  await route.stack[0].handle(req as never, res as never, next);
  expect(data.authenticate).toHaveBeenCalledWith(req, res, next);
  expect(next).not.toHaveBeenCalled();
});

it('queries purchases only for the authenticated user', async () => {
  const res = response();
  await route.stack[1].handle({ authUser: { id: 'user' } } as never, res as never, vi.fn());
  expect(data.purchases).toHaveBeenCalledWith({ userId: 'user', status: 'completed' });
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ purchasedPackageIds: ['premium'] }));
});
