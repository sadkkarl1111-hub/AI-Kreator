import { BADGE_CATALOG, type BadgeCatalogItem } from './badgeCatalog';
import { readLocalDesignImage } from './localDesignExport';
import { newestBadgesFirst } from './badgeLibraryView';

export type CarouselLibrarySource = 'gallery' | 'badges' | 'emoji' | 'icons';
export type CarouselImageTarget = 'element' | 'photo' | 'background';
export type CarouselLibraryImage = { id: string; name: string; src: string; thumbnail: string; inlinePng?: string; description?: string; category?: string; addedAt?: string; locked?: boolean; requiredPackages?: string[] };
export type CarouselBadgeResponse = { ok?: boolean; error?: string; hiddenKeys?: string[]; badges?: BadgeCatalogItem[]; access?: { badge_key: string; package_id: string }[]; packages?: { id: string; label: string }[]; purchasedPackageIds?: string[] };
export type CarouselGalleryResponse = { ok?: boolean; error?: string; graphics?: { id: string; prompt: string; signedUrl?: string | null; signed_url?: string | null; thumbnailUrl?: string | null; thumbnail_url?: string | null; is_broken?: boolean }[] };

export function carouselLibraryBadges(data: CarouselBadgeResponse): CarouselLibraryImage[] {
  if (data.ok === false || data.error) throw new Error(data.error || 'Nie udało się pobrać badge’ów.');
  const hidden = new Set(data.hiddenKeys || []), purchased = new Set(data.purchasedPackageIds || []);
  const items = new Map([...BADGE_CATALOG, ...(data.badges || [])].map(item => [item.id, item]));
  return newestBadgesFirst([...items.values()].filter(item => !hidden.has(item.id))).map(item => {
    const access = (data.access || []).filter(entry => entry.badge_key === item.id);
    return { ...item, thumbnail: item.src, locked: access.length > 0 && !access.some(entry => purchased.has(entry.package_id)), requiredPackages: access.map(entry => data.packages?.find(pack => pack.id === entry.package_id)?.label || 'Wymagany pakiet') };
  });
}
export function carouselLibraryGallery(data: CarouselGalleryResponse): CarouselLibraryImage[] {
  if (data.ok === false || data.error) throw new Error(data.error || 'Nie udało się pobrać galerii.');
  return (data.graphics || []).flatMap(item => {
    const src = item.signedUrl || item.signed_url;
    return !item.is_broken && src ? [{ id: item.id, name: item.prompt?.trim().slice(0, 100) || 'Moja grafika', description: item.prompt || '', src, thumbnail: item.thumbnailUrl || item.thumbnail_url || src }] : [];
  });
}

// Embed pixels rather than expiring signed addresses in the local project.
export async function readCarouselLibraryImage(item: CarouselLibraryImage, target: CarouselImageTarget, signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Wstawianie anulowane.', 'AbortError');
  if (item.locked) throw new Error('Ta grafika jest niedostępna.');
  if (item.inlinePng !== undefined) {
    if (target !== 'element' || item.inlinePng.length > 3_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(item.inlinePng)) throw new Error('Nieprawidłowa ikona PNG.');
    const bytes = Uint8Array.from(atob(item.inlinePng.slice('data:image/png;base64,'.length)), char => char.charCodeAt(0));
    const image = await readLocalDesignImage(new File([bytes], `${item.id}.png`, { type: 'image/png' }), 800);
    if (signal.aborted) throw new DOMException('Wstawianie anulowane.', 'AbortError');
    if (image.dataUrl.length > 3_000_000) throw new Error('Ikona jest zbyt duża.');
    return image.dataUrl;
  }
  const url = new URL(item.src, window.location.href);
  if (!['https:', 'http:'].includes(url.protocol) || item.locked) throw new Error('Ta grafika jest niedostępna.');
  const response = await fetch(url.href, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('Nie udało się pobrać obrazu. Odśwież bibliotekę i spróbuj ponownie.');
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!type || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) throw new Error('Biblioteka obsługuje obrazy PNG, JPG i WebP.');
  if (Number(response.headers.get('content-length')) > 12 * 1024 * 1024) throw new Error('Obraz może mieć maksymalnie 12 MB.');
  const blob = await response.blob();
  if (signal.aborted) throw new DOMException('Wstawianie anulowane.', 'AbortError');
  const image = await readLocalDesignImage(new File([blob], item.name, { type }), target === 'element' ? 800 : 1600);
  if (signal.aborted) throw new DOMException('Wstawianie anulowane.', 'AbortError');
  if (target === 'element' && image.dataUrl.length > 3_000_000) throw new Error('Obraz jest zbyt duży jako element. Wstaw go jako zdjęcie slajdu.');
  return image.dataUrl;
}
