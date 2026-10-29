import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { assertImageBackground, resolveImageBackground, promptRequestsTransparency } from '../dist/lib/imageBackground.js';
import { generateWithOpenAI } from '../dist/routes/ai.js';

const model = 'gpt-image-2.5-sunburst';
const image = async alpha => (await sharp({ create: { width: 20, height: 20, channels: alpha ? 4 : 3, background: { r: 30, g: 60, b: 90, ...(alpha ? { alpha: 0 } : {}) } } }).png().toBuffer()).toString('base64');

test('detects a real transparent-background request in Polish and English, including the smartphone prompt', () => {
  for (const prompt of ['Transparent background (PNG alpha channel). No background, no floor.', 'Telefon PNG bez tła', 'Przezroczyste tło', 'Tło przezroczyste', 'background: transparent']) {
    assert.equal(promptRequestsTransparency(prompt), true, prompt);
    assert.equal(resolveImageBackground(undefined, prompt, 'openai', model), 'transparent');
  }
  for (const prompt of ['opaque background', 'not a transparent background', 'without transparent background', 'studio backdrop', 'Przezroczysta szklana butelka na stole']) assert.equal(promptRequestsTransparency(prompt), false, prompt);
});

test('explicit full background overrides the prompt and unsupported models fail before generation', () => {
  assert.equal(resolveImageBackground('opaque', 'PNG bez tła', 'openai', model), 'opaque');
  assert.equal(resolveImageBackground('auto', 'portret na plaży', 'openai', model), 'auto');
  assert.equal(resolveImageBackground(undefined, 'PNG bez tła', 'google', 'gemini-3-pro-image'), 'auto');
  assert.throws(() => resolveImageBackground('transparent', 'telefon', 'google', 'gemini-3-pro-image'), /UNSUPPORTED/);
  assert.throws(() => resolveImageBackground({}, 'telefon', 'openai', model), /INVALID_IMAGE_BACKGROUND/);
});

test('checks actual transparent pixels instead of file extension or presence of an all-opaque alpha channel', async () => {
  const transparent = await image(true), opaque = await image(false);
  const opaqueAlpha = (await sharp(Buffer.from(opaque, 'base64')).ensureAlpha().png().toBuffer()).toString('base64');
  await assertImageBackground(transparent, 'transparent');
  await assert.rejects(assertImageBackground(opaque, 'transparent'), /TRANSPARENT_BACKGROUND_MISSING/);
  await assert.rejects(assertImageBackground(opaqueAlpha, 'transparent'), /TRANSPARENT_BACKGROUND_MISSING/);
  await assertImageBackground(opaque, 'auto');
  // This is the same resize/PNG operation used in persistent storage.
  const resized = (await sharp(Buffer.from(transparent, 'base64')).resize(40, 60, { fit: 'fill' }).png().toBuffer()).toString('base64');
  await assertImageBackground(resized, 'transparent');
});

test('sends background=transparent and output_format=png in real JSON and multipart request builders without calling an external API', async () => {
  const original = globalThis.fetch, result = await image(true), requests = [];
  globalThis.fetch = async (url, request) => {
    requests.push({ url, request });
    return new Response(JSON.stringify({ data: [{ b64_json: result }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    await generateWithOpenAI('telefon bez tła', '1024x1536', model, [], 'test-only-key', 'transparent');
    await generateWithOpenAI('telefon bez tła', '1024x1536', model, [{ base64: result, mimeType: 'image/png' }], 'test-only-key', 'transparent');
    const json = JSON.parse(requests[0].request.body);
    assert.equal(json.background, 'transparent'); assert.equal(json.output_format, 'png');
    assert.match(json.prompt, /real transparent alpha channel/);
    assert.equal(requests[1].url, 'https://api.openai.com/v1/images/edits');
    const form = requests[1].request.body;
    assert.equal(form.get('background'), 'transparent'); assert.equal(form.get('output_format'), 'png');
    assert.equal(form.getAll('image[]').length, 1); assert.equal(form.has('input_fidelity'), false);
    globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ b64_json: await image(false) }] }));
    await assert.rejects(generateWithOpenAI('telefon', '1024x1536', model, [], 'test-only-key', 'transparent'), /TRANSPARENT_BACKGROUND_MISSING/);
  } finally { globalThis.fetch = original; }
});
