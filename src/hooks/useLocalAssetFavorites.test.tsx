import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLocalAssetFavorites } from './useLocalAssetFavorites';
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('persists IDs across mounts, syncs open pickers and separates badges from icons', () => {
  const first = renderHook(() => useLocalAssetFavorites('icons'));
  const second = renderHook(() => useLocalAssetFavorites('icons'));
  const badges = renderHook(() => useLocalAssetFavorites('badges'));
  act(() => first.result.current.toggle('webhook'));
  expect(second.result.current.has('webhook')).toBe(true);
  expect(badges.result.current.ids).toEqual([]);
  first.unmount();
  const restored = renderHook(() => useLocalAssetFavorites('icons'));
  expect(restored.result.current.ids).toEqual(['webhook']);
  act(() => second.result.current.toggle('webhook'));
  expect(restored.result.current.ids).toEqual([]);
});
it('handles corrupt storage and keeps favorites usable when storage is blocked', () => {
  localStorage.setItem('kreator-favorites-icons-v1', '{broken');
  const hook = renderHook(() => useLocalAssetFavorites('icons'));
  expect(hook.result.current.ids).toEqual([]);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  act(() => hook.result.current.toggle('bookmark'));
  expect(hook.result.current.has('bookmark')).toBe(true);
  act(() => hook.result.current.toggle('bookmark'));
  expect(hook.result.current.ids).toEqual([]);
});
it('validates stored IDs and accepts changes from another browser tab', () => {
  localStorage.setItem('kreator-favorites-badges-v1', JSON.stringify(['work-live', 'work-live', null, 123, '', 'x'.repeat(121)]));
  const hook = renderHook(() => useLocalAssetFavorites('badges'));
  expect(hook.result.current.ids).toEqual(['work-live']);
  localStorage.removeItem('kreator-favorites-badges-v1');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'kreator-favorites-badges-v1' })));
  expect(hook.result.current.ids).toEqual([]);
});
