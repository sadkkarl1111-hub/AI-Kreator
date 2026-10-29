import type { BadgeCatalogItem } from './badgeCatalog';

export const badgeIsNew = (badge: Pick<BadgeCatalogItem, 'addedAt'>, now = Date.now()) => {
  const added = Date.parse(badge.addedAt || '');
  return Number.isFinite(added) && added <= now && added >= now - 30 * 24 * 60 * 60 * 1000;
};

export function newestBadgesFirst<T extends Pick<BadgeCatalogItem, 'addedAt'>>(badges: T[]): T[] {
  const time = (item: T) => Date.parse(item.addedAt || '') || 0;
  return [...badges].sort((a, b) => time(b) - time(a));
}
