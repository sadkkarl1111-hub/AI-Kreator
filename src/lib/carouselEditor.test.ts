import { describe, expect, it } from 'vitest';
import { carouselHistoryReducer as reduce, createCarouselHistory, type CarouselDocument } from './carouselHistory';
import { defaultCarouselDesign, initialCarouselSlides } from './carouselDesign';
import { applyCarouselTemplate, CAROUSEL_TEMPLATES } from './carouselTemplates';
import { parseCarouselProject, serializeCarouselProject } from './carouselProject';
import { reorderSticker, snapStickerPosition, validateStickers, type SlideSticker } from './carouselStickers';
import { checkGifLimits, gifFrameAt, isStickerAnimated } from './carouselStickerAssets';
import type { ParsedGif } from 'gifuct-js';
import { carouselGifDuration } from './carouselGif';
import { prepareCarouselDraft } from './carouselDraft';
const document: CarouselDocument = { design: { ...defaultCarouselDesign }, slides: initialCarouselSlides.map((slide, index) => ({ ...slide, id: `slide-${index}` })) };
const sticker: SlideSticker = { id: 'one', kind: 'heart', x: 50, y: 50, size: 20, rotation: 0, color: '#ff0000', motion: 'none' };
const rename = (name: string) => (project: CarouselDocument) => ({ ...project, design: { ...project.design, brand: name } });
describe('carousel undo and redo', () => {
  it('keeps the recovery journal small and deduplicates large media without losing document metadata', () => {
    const image = `data:image/png;base64,${'A'.repeat(1000000)}`;
    const draft = prepareCarouselDraft({ ...document, design: { ...document.design, logo: image }, slides: [{ ...document.slides[0], image, stickers: [{ ...sticker, kind: 'custom', asset: { data: image, name: 'my.png' } }] }] });
    expect(draft.assets.size).toBe(1); expect(draft.journal.length).toBeLessThan(3000);
    const metadata = JSON.parse(draft.journal); expect(metadata.project.slides[0].title).toBe(document.slides[0].title); expect(metadata.project.design.logo).toEqual(metadata.project.slides[0].image);
  });
  it('restores the whole document, keeps redo and clears it after a new edit', () => {
    let history = createCarouselHistory(document);
    history = reduce(history, { type: 'change', update: rename('Nowa marka'), time: 1 });
    history = reduce(history, { type: 'change', update: project => applyCarouselTemplate(project, 'offer'), time: 2 });
    history = reduce(history, { type: 'undo' }); expect(history.present.slides).toEqual(document.slides); expect(history.present.design.brand).toBe('Nowa marka');
    history = reduce(history, { type: 'undo' }); expect(history.present).toEqual(document);
    history = reduce(history, { type: 'redo' }); expect(history.present.design.brand).toBe('Nowa marka');
    history = reduce(history, { type: 'change', update: rename('Trzecia marka'), time: 3 }); expect(history.future).toEqual([]);
  });
  it('groups a drag of any duration as one undo step, then records the next action', () => {
    let history = reduce(createCarouselHistory(document), { type: 'begin' });
    for (let index = 0; index < 100; index++) history = reduce(history, { type: 'change', update: rename(String(index)), time: index * 1000 });
    expect(history.past).toHaveLength(1);
    history = reduce(history, { type: 'end' }); history = reduce(history, { type: 'change', update: rename('next'), time: 500000 });
    expect(history.past).toHaveLength(2); history = reduce(history, { type: 'undo' }); expect(history.present.design.brand).toBe('99');
    history = reduce(history, { type: 'undo' }); expect(history.present).toEqual(document);
  });
  it('coalesces typing, limits history to 40 steps and resets it on draft restoration', () => {
    let history = createCarouselHistory(document);
    history = reduce(history, { type: 'change', update: rename('a'), group: 'brand', time: 1 });
    history = reduce(history, { type: 'change', update: rename('ab'), group: 'brand', time: 100 });
    expect(history.past).toHaveLength(1);
    for (let index = 0; index < 50; index++) history = reduce(history, { type: 'change', update: rename(String(index)), time: 1000 + index * 1000 });
    expect(history.past).toHaveLength(40); expect(reduce(history, { type: 'restore', value: document })).toEqual(createCarouselHistory(document));
  });
});
describe('templates, layers and snap guides', () => {
  it('creates twenty-four valid independent projects while preserving uploaded branding', () => {
    expect(CAROUSEL_TEMPLATES).toHaveLength(24);
    const source = { ...document, design: { ...document.design, logo: 'data:image/png;base64,AA==', brand: 'Moja firma' } };
    for (const template of CAROUSEL_TEMPLATES) {
      const project = applyCarouselTemplate(source, template.id), roundtrip = parseCarouselProject(serializeCarouselProject(project.slides, project.design));
      expect(roundtrip.design.brand).toBe('Moja firma'); expect(roundtrip.design.logo).toBe(source.design.logo);
      expect(project.slides.length).toBeGreaterThanOrEqual(4); expect(new Set(project.slides.map(slide => slide.id)).size).toBe(project.slides.length);
      expect(project.slides.every(slide => slide.body.length <= 500 && slide.title.length <= 100)).toBe(true);
    }
    expect(source.slides).toBe(document.slides);
  });
  it('moves layers without mutating data and snaps to center/other visible objects', () => {
    const stickers = [sticker, { ...sticker, id: 'two', x: 72, y: 33 }];
    expect(reorderSticker(stickers, 'one', true).map(item => item.id)).toEqual(['two', 'one']); expect(stickers[0]).toBe(sticker);
    expect(snapStickerPosition(49, 33.8, stickers)).toMatchObject({ x: 50, y: 33, guideX: 50, guideY: 33 });
    expect(snapStickerPosition(20, -10)).toMatchObject({ x: 20, y: 0, guideX: undefined });
    expect(snapStickerPosition(72, 33, [{ ...stickers[1], hidden: true }]).guideY).toBeUndefined();
  });
  it('round-trips custom art, hidden/locked layers, order and photo frames and rejects external content', () => {
    const custom = { ...sticker, id: 'custom', kind: 'custom', asset: { data: 'data:image/gif;base64,AAAA', name: 'my.gif' }, layer: 'back' as const, hidden: true, locked: true };
    const project = parseCarouselProject(serializeCarouselProject([{ ...document.slides[0], stickers: [custom, sticker], imageFrame: 'circle' }], document.design));
    expect(project.slides[0].stickers).toEqual([custom, sticker]); expect(project.slides[0].imageFrame).toBe('circle');
    for (const update of [{ asset: { data: 'https://example.com/art.gif', name: 'file' } }, { layer: 'bad' }, { hidden: 'yes' }, { locked: 1 }]) expect(() => validateStickers([{ ...custom, ...update }])).toThrow();
    expect(() => parseCarouselProject(serializeCarouselProject([{ ...document.slides[0], imageFrame: 'unknown' }], document.design))).toThrow();
  });
});
describe('imported GIF timing and bounds', () => {
  const frame = { image: { descriptor: { top: 0, left: 0, width: 100, height: 100 }, data: { minCodeSize: 2 } }, gce: { delay: 10 } };
  const gif = { header: { signature: 'GIF' }, lsd: { width: 100, height: 100 }, frames: [frame, frame] } as unknown as ParsedGif;
  it('selects frames by their individual delays including the looping boundary', () => {
    const one = {} as HTMLCanvasElement, two = {} as HTMLCanvasElement, asset = { width: 100, height: 100, duration: 300, frames: [{ image: one, delay: 100 }, { image: two, delay: 200 }] };
    expect(gifFrameAt(asset, 99)).toBe(one); expect(gifFrameAt(asset, 100)).toBe(two); expect(gifFrameAt(asset, 300)).toBe(one);
    expect(isStickerAnimated({ ...sticker, asset: { data: 'data:image/gif;base64,AAAA', name: 'file.gif' } })).toBe(true);
    expect(isStickerAnimated({ ...sticker, motion: 'pulse', hidden: true })).toBe(false);
    const custom = { ...sticker, asset: { data: 'data:image/gif;base64,AAAA', name: 'file.gif' } };
    const images = new Map([[custom.asset.data, { ...asset, duration: 600 }]]);
    expect(carouselGifDuration([custom], images)).toBe(600);
    expect(carouselGifDuration([custom, { ...sticker, motion: 'pulse' }], images)).toBe(4800);
  });
  it('rejects excessive dimensions, frames, decoded pixels, durations and frame offsets before decoding', () => {
    expect(checkGifLimits(gif).duration).toBe(200);
    for (const bad of [{ ...gif, lsd: { ...gif.lsd, width: 10000 } }, { ...gif, frames: Array(41).fill(frame) }, { ...gif, lsd: { ...gif.lsd, width: 800, height: 800 }, frames: Array(40).fill(frame) }, { ...gif, frames: [{ ...frame, gce: { delay: 1000 } }] }, { ...gif, frames: [{ ...frame, image: { ...frame.image, descriptor: { ...frame.image.descriptor, left: 1 } } }] }]) expect(() => checkGifLimits(bad as ParsedGif)).toThrow();
  });
});
