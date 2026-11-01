import { expect, it } from 'vitest';
import { badgeAppearance, BADGE_LOOKS } from './badgeAppearance';
import { BADGE_CATALOG } from './badgeCatalog';

it('classifies every shipped badge and includes the legacy 3D assets in the 3D group', () => {
  for (const badge of BADGE_CATALOG) {
    expect(BADGE_LOOKS.map(look => look.id), badge.id).toContain(badge.look);
    expect(badge.style, badge.id).toBeTruthy();
    expect(badge.colors?.length, badge.id).toBeGreaterThan(0);
    expect(badge.look, badge.id).not.toBe('other');
  }
  for (const id of ['webinar-niebieski-prezent', 'webinar-granatowy-prezent', 'webinar-odblokuj-materialy', 'bonus-bundle-3d', 'bonus-course-3d', 'premium-return-14-blue']) {
    expect(BADGE_CATALOG.find(badge => badge.id === id)?.look, id).toBe('3d');
  }
  expect(BADGE_CATALOG.find(badge => badge.id === 'webinar-od-podstaw')?.look).toBe('drawn');
  expect(BADGE_CATALOG.find(badge => badge.id === 'sales-v1-return30-neon')?.look).toBe('neon');
});

it('indexes each palette color so a gold filter can also find gold/blue artwork', () => {
  const badge = BADGE_CATALOG.find(badge => badge.id === 'sales-v1-return30-seal')!;
  expect(badge.colors).toContain('Złoty');
  expect(badge.colors).toContain('Niebieski');
});

it('does not invent a 3D style for unclassified custom uploads', () => {
  expect(badgeAppearance({ id: 'custom-upload', name: 'Moja grafika', description: '' }).look).toBe('other');
});
