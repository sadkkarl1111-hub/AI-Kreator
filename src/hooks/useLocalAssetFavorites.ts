import { useCallback, useEffect, useState } from 'react';

const eventName = 'kreator-asset-favorites';
const read = (key: string): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 120))].slice(0, 1000) : [];
  } catch { return []; }
};

// IDs only; never store access rights or image data here.
export function useLocalAssetFavorites(scope: 'badges' | 'icons') {
  const key = `kreator-favorites-${scope}-v1`;
  const [ids, setIds] = useState<string[]>(() => read(key));
  useEffect(() => {
    const refresh = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== key && event.key !== null) return;
      if (event instanceof CustomEvent && event.detail?.key !== key) return;
      setIds(read(key));
    };
    window.addEventListener('storage', refresh);
    window.addEventListener(eventName, refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener(eventName, refresh); };
  }, [key]);
  const toggle = useCallback((id: string) => {
    if (!id || id.length > 120) return;
    const next = ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id].slice(-1000);
    setIds(next);
    try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new CustomEvent(eventName, { detail: { key } })); } catch { /* Favorites still work in memory when storage is unavailable. */ }
  }, [ids, key]);
  return { ids, toggle, has: (id: string) => ids.includes(id) };
}
