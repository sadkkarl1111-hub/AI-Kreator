import { afterEach, describe, expect, it, vi } from 'vitest';
import { carouselLibraryBadges, carouselLibraryGallery, readCarouselLibraryImage } from './carouselLibrary';
import { createCarouselEmoji, validateStickers } from './carouselStickers';
import { parseCarouselProject, serializeCarouselProject } from './carouselProject';
import { defaultCarouselDesign, initialCarouselSlides } from './carouselDesign';
import { readLocalDesignImage } from './localDesignExport';
vi.mock('./localDesignExport', async original => ({ ...await original<typeof import('./localDesignExport')>(), readLocalDesignImage: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('carousel account libraries', () => {
  it('normalizes local icon PNG pixels without contacting an image host', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    vi.mocked(readLocalDesignImage).mockResolvedValue({ dataUrl: 'data:image/png;base64,YQ==', width: 800, height: 800 });
    const item = { id: 'icon-webhook', name: 'Webhook', src: '', thumbnail: '', inlinePng: 'data:image/png;base64,YQ==' };
    expect(await readCarouselLibraryImage(item, 'element', new AbortController().signal)).toBe('data:image/png;base64,YQ==');
    expect(fetcher).not.toHaveBeenCalled();
    expect(readLocalDesignImage).toHaveBeenCalledWith(expect.any(File), 800);
    for (const inlinePng of ['data:image/svg+xml;base64,YQ==', 'https://example.test/icon.png', 'data:image/png;base64,!' ]) {
      await expect(readCarouselLibraryImage({ ...item, inlinePng }, 'element', new AbortController().signal)).rejects.toThrow(/PNG/);
    }
    await expect(readCarouselLibraryImage({ ...item, locked: true }, 'element', new AbortController().signal)).rejects.toThrow(/niedostępna/);
    await expect(readCarouselLibraryImage(item, 'background', new AbortController().signal)).rejects.toThrow(/PNG/);
    const controller = new AbortController(); controller.abort();
    await expect(readCarouselLibraryImage(item, 'element', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('excludes hidden static and uploaded badges and locks packages until a matching purchase', () => {
    const data = { hiddenKeys: ['free', 'db-hidden'], badges: [{ id: 'db-hidden', name: 'Hidden', description: '', category: '', src: '/hidden.png' }], access: [{ badge_key: 'sale50', package_id: 'premium' }], packages: [{ id: 'premium', label: 'Premium' }] };
    const guest = carouselLibraryBadges(data);
    expect(guest.some(item => ['free', 'db-hidden'].includes(item.id))).toBe(false);
    expect(guest.find(item => item.id === 'sale50')).toMatchObject({ locked: true, requiredPackages: ['Premium'] });
    expect(carouselLibraryBadges({ ...data, purchasedPackageIds: ['premium'] }).find(item => item.id === 'sale50')?.locked).toBe(false);
    expect(() => carouselLibraryBadges({ ok: false })).toThrow();
  });
  it('only uses display URLs returned by the authenticated gallery and excludes broken graphics', () => {
    const items = carouselLibraryGallery({ graphics: [{ id: 'a', prompt: 'Mój lis', signed_url: '/signed.png', thumbnail_url: '/thumb.webp' }, { id: 'broken', prompt: '', is_broken: true, signedUrl: '/broken' }, { id: 'missing', prompt: '' }] });
    expect(items).toEqual([{ id: 'a', name: 'Mój lis', description: 'Mój lis', src: '/signed.png', thumbnail: '/thumb.webp' }]);
    expect(() => carouselLibraryGallery({ ok: false })).toThrow();
  });
  it('embeds pixels at the right resolution without sending account credentials to image hosts', async () => {
    vi.mocked(readLocalDesignImage).mockResolvedValue({ dataUrl: 'data:image/png;base64,YQ==', width: 1024, height: 1024 });
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(new Blob(['pixels'], { type: 'image/webp' }), { headers: { 'Content-Type': 'image/webp' } }))); vi.stubGlobal('fetch', fetcher);
    const item = { id: 'one', name: 'Lis', src: 'https://images.example/one?signed=token', thumbnail: '/thumb' };
    const signal = new AbortController().signal;
    expect(await readCarouselLibraryImage(item, 'element', signal)).toBe('data:image/png;base64,YQ==');
    expect(fetcher).toHaveBeenCalledWith(item.src, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    expect(readLocalDesignImage).toHaveBeenLastCalledWith(expect.any(File), 800);
    await readCarouselLibraryImage(item, 'background', signal); expect(readLocalDesignImage).toHaveBeenLastCalledWith(expect.any(File), 1600);
  });
  it('rejects unavailable, locked, non-image and oversized image responses', async () => {
    const item = { id: 'one', name: 'One', src: '/image', thumbnail: '/thumb' }, signal = new AbortController().signal;
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(readCarouselLibraryImage({ ...item, locked: true }, 'element', signal)).rejects.toThrow();
    await expect(readCarouselLibraryImage({ ...item, src: 'javascript:alert(1)' }, 'element', signal)).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValueOnce(new Response('', { status: 403 })); await expect(readCarouselLibraryImage(item, 'element', signal)).rejects.toThrow(/Odśwież/);
    fetcher.mockResolvedValueOnce(new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } })); await expect(readCarouselLibraryImage(item, 'element', signal)).rejects.toThrow(/PNG/);
    fetcher.mockResolvedValueOnce(new Response('', { headers: { 'Content-Type': 'image/png', 'Content-Length': '13000000' } })); await expect(readCarouselLibraryImage(item, 'element', signal)).rejects.toThrow(/12 MB/);
  });
});
describe('movable emoji', () => {
  it('preserves compound emoji, layers and motion through project import, without counting them as custom images', () => {
    const stickers = Array.from({ length: 16 }, () => ({ ...createCarouselEmoji('👩🏽‍💻', '#aa3377')!, motion: 'wiggle' as const, layer: 'back' as const }));
    expect(validateStickers(stickers)).toEqual(stickers);
    const parsed = parseCarouselProject(serializeCarouselProject([{ ...initialCarouselSlides[0], id: 'one', stickers }], defaultCarouselDesign)); expect(parsed.slides[0].stickers).toEqual(stickers);
    expect(() => validateStickers([...stickers, createCarouselEmoji('🔥', '#aa3377')!])).toThrow();
  });
  it('rejects malformed or oversized symbols while supporting the existing text arrow catalog', () => {
    for (const value of ['', 'x'.repeat(33), '😀\n', ' 😀']) expect(createCarouselEmoji(value, '#aa3377')).toBeNull();
    expect(createCarouselEmoji('»', '#aa3377')).toMatchObject({ kind: 'emoji', emoji: '»' });
    expect(() => validateStickers([{ ...createCarouselEmoji('🔥', '#aa3377'), emoji: null }])).toThrow();
  });
});
