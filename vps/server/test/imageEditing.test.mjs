import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { applyEditMask, badgeEditInstruction, prepareEditMask, preservingEditPrompt } from '../dist/lib/imageEditing.js';
import { editWithOpenAI, editWithGemini } from '../dist/routes/ai.js';

const png = async (pixels, width, height) => (await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer()).toString('base64');
const raw = async base64 => sharp(Buffer.from(base64, 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
async function fixture() {
  const width = 8, height = 12, source = Buffer.alloc(width * height * 4);
  for (let i = 0; i < source.length; i++) source[i] = (i * 37) % 256;
  const guide = Buffer.alloc(2 * 3 * 4, 255);
  guide[1] = guide[2] = 0; // top-left 4x4 area after nearest resize
  const original = await png(source, width, height);
  return { original, mask: await prepareEditMask(original, await png(guide, 2, 3)) };
}

test('normalizes the red guide to original dimensions and converts it to OpenAI alpha correctly', async () => {
  const { mask } = await fixture();
  assert.equal(mask.width, 8); assert.equal(mask.height, 12);
  assert.equal(mask.selection.reduce((sum, n) => sum + n, 0), 16);
  const alpha = await raw(mask.alphaMaskBase64), red = await raw(mask.redMaskBase64);
  for (let p = 0; p < 96; p++) {
    assert.equal(alpha.data[p * 4 + 3], mask.selection[p] ? 0 : 255);
    assert.deepEqual([...red.data.subarray(p * 4, p * 4 + 4)], mask.selection[p] ? [255, 0, 0, 255] : [255, 255, 255, 255]);
  }
});

test('preserves every unselected RGBA byte even if AI redraws the entire image and changes its resolution', async () => {
  const { mask } = await fixture();
  const pixels = Buffer.alloc(4 * 6 * 4, 200);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  const changed = await png(pixels, 4, 6);
  const result = await applyEditMask(changed, mask), decoded = await raw(result.base64);
  assert.equal(result.mimeType, 'image/png'); assert.equal(decoded.info.width, 8); assert.equal(decoded.info.height, 12);
  for (let p = 0; p < mask.selection.length; p++) {
    const actual = decoded.data.subarray(p * 4, p * 4 + 4);
    assert.deepEqual(actual, mask.selection[p] ? Buffer.from([200, 200, 200, 255]) : mask.sourcePixels.subarray(p * 4, p * 4 + 4));
  }
});

test('supports removing selected artwork to transparency without changing transparent pixels elsewhere', async () => {
  const { mask } = await fixture();
  const result = await applyEditMask(await png(Buffer.alloc(8 * 12 * 4), 8, 12), mask);
  const decoded = await raw(result.base64);
  for (let p = 0; p < 96; p++) {
    assert.deepEqual(decoded.data.subarray(p * 4, p * 4 + 4), mask.selection[p] ? Buffer.alloc(4) : mask.sourcePixels.subarray(p * 4, p * 4 + 4));
  }
});

test('text and color edits lock the original alpha silhouette even inside the selection', async () => {
  const pixels = Buffer.from([0, 0, 0, 0, 45, 60, 90, 100, 120, 40, 50, 255]);
  const original = await png(pixels, 3, 1);
  const mask = await prepareEditMask(original, await png(Buffer.from([255, 0, 0, 255]), 1, 1));
  const result = await applyEditMask(await png(Buffer.alloc(12, 255), 3, 1), mask, true);
  const decoded = await raw(result.base64);
  assert.deepEqual([...decoded.data], [0, 0, 0, 0, 255, 255, 255, 100, 255, 255, 255, 255]);
});

test('rejects empty, erased, white, transparent and unreadable masks before contacting a provider', async () => {
  const { original } = await fixture();
  for (const color of [[255, 255, 255, 255], [255, 0, 0, 0], [0, 0, 0, 255]]) {
    await assert.rejects(prepareEditMask(original, await png(Buffer.from(color), 1, 1)), /Zaznacz/);
  }
  await assert.rejects(prepareEditMask(original, 'invalid-image'), /odczytać/);
  await assert.rejects(prepareEditMask('invalid-image', original), /odczytać/);
});

test('text and color operations constrain only the requested property and retain original technique', () => {
  const text = badgeEditInstruction({ action: 'replace-text', oldText: 'NA ŻYWO', newText: 'LIVE' }, 'irrelevant');
  assert.match(text, /"NA ŻYWO" with exactly "LIVE"/); assert.match(text, /original lettering technique/);
  const color = badgeEditInstruction({ action: 'change-color', target: 'nagłówek', color: '#2048A0' }, '');
  assert.match(color, /#2048A0/); assert.match(color, /all lettering verbatim/);
  assert.match(badgeEditInstruction({ action: 'remove-element', target: 'gwiazdę' }, ''), /Remove only/);
  assert.equal(badgeEditInstruction({ action: 'custom' }, 'Zmień tylko napis na LIVE'), 'Zmień tylko napis na LIVE');
  assert.equal(badgeEditInstruction(undefined, 'Remove background'), 'Remove background');
  for (const value of [null, {}, { action: 'replace-text', oldText: 'X', newText: '' }, { action: 'change-color', target: '', color: 'red' }]) {
    assert.throws(() => badgeEditInstruction(value, ''), /edycji|Uzupełnij|Wybierz/);
  }
  assert.match(preservingEditPrompt('zmień kolor', true), /pencil must stay pencil/);
  assert.match(preservingEditPrompt('zmień kolor', true), /color-only request.*every inscription verbatim/);
});

test('all OpenAI masked edits use the real original and alpha mask at images/edits, with no description or generation fallback', async () => {
  const { original, mask } = await fixture(), oldFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, request) => {
    requests.push({ url, request });
    return new Response(JSON.stringify({ data: [{ b64_json: original }] }));
  };
  try {
    for (const apiModel of ['gpt-image-2', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-1.5', 'gpt-image-1-mini']) {
      const result = await editWithOpenAI({ prompt: 'NA ŻYWO -> LIVE', imageBase64: original, imageMimeType: 'image/png', editMask: mask, apiModel, apiKey: 'test-only' });
      assert.equal(result.base64, original);
      const { url, request } = requests.at(-1), form = request.body;
      assert.equal(url, 'https://api.openai.com/v1/images/edits');
      assert.equal(form.getAll('image[]').length, 1);
      assert.equal(form.get('size'), 'auto'); assert.equal(form.get('output_format'), 'png');
      assert.match(form.get('prompt'), /All pixels outside it are locked/);
      assert.equal(Buffer.from(await form.get('mask').arrayBuffer()).toString('base64'), mask.alphaMaskBase64);
      assert.equal(Buffer.from(await form.get('image[]').arrayBuffer()).toString('base64'), mask.sourceBase64);
      assert.equal(form.has('input_fidelity'), apiModel === 'gpt-image-1.5');
    }
    assert.equal(requests.length, 5);
    await assert.rejects(editWithOpenAI({ prompt: 'edit', imageBase64: original, imageMimeType: 'image/png', apiModel: 'dall-e-3', apiKey: 'test-only' }), /nie obsługuje edycji/);
    assert.equal(requests.length, 5);
    await editWithOpenAI({ prompt: 'edit', imageBase64: original, imageMimeType: 'image/png', apiModel: 'gpt-image-2', apiKey: 'test-only' });
    assert.equal(requests.at(-1).request.body.has('mask'), false);
  } finally { globalThis.fetch = oldFetch; }
});

test('provider errors are returned without silently generating a new badge', async () => {
  const { original, mask } = await fixture(), oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: { message: 'test unavailable' } }), { status: 500 }); };
  try {
    await assert.rejects(editWithOpenAI({ prompt: 'LIVE', imageBase64: original, imageMimeType: 'image/png', editMask: mask, apiModel: 'gpt-image-2.5-sunburst', apiKey: 'test-only' }));
    assert.equal(calls, 1);
  } finally { globalThis.fetch = oldFetch; }
});

test('Gemini receives the original and separate source-sized red guide with the same preservation instructions', async () => {
  const { original, mask } = await fixture(), oldFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, request) => {
    body = JSON.parse(request.body);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: original, mimeType: 'image/png' } }] } }] }));
  };
  try {
    await editWithGemini({ prompt: 'zmień tylko kolor', imageBase64: original, imageMimeType: 'image/png', editMask: mask, apiModel: 'gemini-3.1-flash-image', apiKey: 'test-only' });
    const parts = body.contents[0].parts;
    assert.equal(parts[0].inlineData.data, mask.sourceBase64); assert.equal(parts[1].inlineData.data, mask.redMaskBase64);
    assert.match(parts[2].text, /pencil must stay pencil/); assert.match(parts[2].text, /White regions are locked/);
  } finally { globalThis.fetch = oldFetch; }
});
