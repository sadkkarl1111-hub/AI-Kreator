import { describe, expect, it } from 'vitest';
import { badgeIsNew, newestBadgesFirst } from './badgeLibraryView';
import { BADGE_CATALOG } from './badgeCatalog';

describe('badge visibility and release order', () => {
  it('uses unique IDs so hiding and package settings identify exactly one badge', () => {
    expect(new Set(BADGE_CATALOG.map(badge => badge.id)).size).toBe(BADGE_CATALOG.length);
  });
  const now = Date.parse('2026-10-25T16:00:00Z');
  it('marks only valid releases in the last 30 days as new', () => {
    expect(badgeIsNew({ addedAt: '2026-10-25T15:00:00Z' }, now)).toBe(true);
    for (const addedAt of [undefined, 'invalid', '2026-09-01', '2026-10-26']) expect(badgeIsNew({ addedAt }, now)).toBe(false);
  });
  it('puts the latest releases first while retaining every item and the original order for undated badges', () => {
    const items = [{ id: 'old-a' }, { id: 'morning', addedAt: '2026-10-25T12:00:00Z' }, { id: 'old-b' }, { id: 'latest', addedAt: '2026-10-25T15:00:00Z' }];
    expect(newestBadgesFirst(items).map(item => item.id)).toEqual(['latest', 'morning', 'old-a', 'old-b']);
    expect(items[0].id).toBe('old-a');
  });
});
