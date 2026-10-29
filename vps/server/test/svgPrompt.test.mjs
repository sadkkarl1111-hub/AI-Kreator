import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { generatePromptSvg, parseSvgPromptOptions, renderSvgScene, buildSvgInstructions } from '../dist/lib/svgPromptAi.js';
import { createSvgPromptRouter, getSvgClientIp } from '../dist/routes/svgPrompt.js';

const options = { prompt: 'Lis na księżycu', width: 1024, height: 1024, transparent: true, background: '#ffffff', style: 'illustration' };
const paidOptions = { ...options, expectedCreditCost: 10 };
let userSequence = 0;
function paidRouter(key, generate, billing = {}) {
  const userId = `svg-test-${++userSequence}`;
  return createSvgPromptRouter(key, generate, {
    pricing: async () => ({ active: true, creditCost: 10 }),
    reserve: async () => 10,
    complete: async () => {},
    refund: async () => {},
    ...billing,
  }, (request, _response, next) => { request.authUser = { id: userId, email: null }; next(); });
}
const shape = (tag, attrs, text = '') => ({ tag, attributes: Object.entries(attrs).map(([name, value]) => ({ name, value: String(value) })), text });
const scene = { title: 'Lis & księżyc', elements: [shape('path', { d: 'M 100 100 C 150 20 200 20 250 100 Z', fill: '#ff8800' }), shape('text', { x: 200, y: 300, 'font-size': 30 }, '<script>alert("x")</script>')] };

test('validates prompt and canvas before contacting the provider', () => {
  assert.deepEqual(parseSvgPromptOptions(options), options);
  for (const change of [{ prompt: 'x' }, { prompt: 'x'.repeat(2001) }, { width: 0 }, { height: 4096 }, { width: '1024' }, { background: 'url(https://bad)' }, { transparent: 'true' }, { style: 'unknown' }]) {
    assert.throws(() => parseSvgPromptOptions({ ...options, ...change }), /Opis|rozmiar|kolor|rodzaj/);
  }
});
test('exports true vector shapes with escaped captions and controlled backgrounds', () => {
  const result = renderSvgScene(scene, options);
  assert.match(result.svg, /viewBox="0 0 1024 1024"/);
  assert.match(result.svg, /Lis &amp; księżyc/);
  assert.match(result.svg, /&lt;script&gt;/);
  assert.doesNotMatch(result.svg, /<script|<image|<rect/);
  assert.match(renderSvgScene(scene, { ...options, transparent: false }).svg, /<rect width="1024" height="1024" fill="#ffffff"/);
});
test('rejects executable elements, URLs, event attributes and malformed/oversized scenes', () => {
  for (const element of [shape('script', {}), shape('foreignObject', {}), shape('image', { href: 'data:image/png;base64,AA==' }), shape('path', { d: 'M 0 0', onclick: 'alert(1)' }), shape('path', { d: 'M 0 0', fill: 'url(https://bad)' }), shape('path', { d: 'M 0 0', transform: 'javascript:alert(1)' }), shape('path', { d: 'M 0 0'.repeat(2000) }), shape('circle', { cx: 10, cy: 10, r: -2 }), shape('path', { fill: '#ffffff' })]) {
    assert.throws(() => renderSvgScene({ title: 'test', elements: [element] }, options), /niepoprawną/);
  }
  assert.throws(() => renderSvgScene({ ...scene, elements: Array(181).fill(scene.elements[0]) }, options));
  assert.throws(() => renderSvgScene({ title: 'empty', elements: [] }, options));
});
test('sends the actual user prompt and JSON drawing schema to Gemini', async () => {
  let called = false;
  const result = await generatePromptSvg(options, 'test-key', new AbortController().signal, async (url, init) => {
    called = true;
    assert.match(url, /gemini-3.8-flash:generateContent$/);
    assert.equal(init.headers['x-goog-api-key'], 'test-key');
    const body = JSON.parse(init.body);
    assert.equal(body.contents[0].parts[0].text, options.prompt);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'LOW' });
    assert.match(body.systemInstruction.parts[0].text, /transparent/);
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'hidden reasoning' }, { text: JSON.stringify(scene) }] } }] });
  });
  assert.equal(called, true);
  assert.match(result.svg, /<path/);
});
test('gives icons, illustrations, logos and patterns distinct visual directions without losing the brief or canvas', () => {
  const expected = { icon: /outline icon/, illustration: /coherent anatomy/, logo: /brand mark/, pattern: /repeat pattern/ };
  for (const [style, pattern] of Object.entries(expected)) {
    const instructions = buildSvgInstructions({ ...options, style, width: 1200, height: 800 });
    assert.match(instructions, pattern);
    assert.match(instructions, /Canvas 1200 by 800/);
    assert.match(instructions, /no full-canvas background/);
  }
  assert.match(buildSvgInstructions({ ...options, transparent: false }), /background in #ffffff/);
});
test('does not substitute a template on missing key, provider quota, truncation or invalid drawing data', async () => {
  const signal = new AbortController().signal;
  await assert.rejects(generatePromptSvg(options, '', signal), { status: 503 });
  await assert.rejects(generatePromptSvg(options, 'key', signal, async () => new Response('{}', { status: 429 })), { status: 429 });
  for (const payload of [{ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(scene) }] } }] }, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] }, { promptFeedback: { blockReason: 'SAFETY' } }]) {
    await assert.rejects(generatePromptSvg(options, 'key', signal, async () => Response.json(payload)), { status: 502 });
  }
});
test('an already cancelled request never starts provider work', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await assert.rejects(generatePromptSvg(options, 'key', controller.signal, async () => { calls++; return Response.json({}); }));
  assert.equal(calls, 0);
});

async function withServer(router, action) {
  const app = express(); app.use(express.json()); app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('uses the client IP appended by the reverse proxy, ignoring spoofed leading entries and X-Real-IP', () => {
  const request = headers => ({ header: name => headers[name], socket: { remoteAddress: '127.0.0.1' } });
  assert.equal(getSvgClientIp(request({ 'x-forwarded-for': '198.51.100.1, 203.0.113.22', 'x-real-ip': '192.0.2.99' })), '203.0.113.22');
  assert.equal(getSvgClientIp(request({ 'x-forwarded-for': '2001:db8::10' })), '2001:db8::10');
  assert.equal(getSvgClientIp(request({ 'x-forwarded-for': 'invalid', 'x-real-ip': '192.0.2.99' })), '127.0.0.1');
  assert.equal(getSvgClientIp(request({})), '127.0.0.1');
});
test('disabled generator reports unavailable and never calls AI', async () => {
  let calls = 0;
  await withServer(paidRouter('', async () => { calls++; }), async base => {
    const status = await fetch(`${base}/public/svg-generator`);
    assert.equal(status.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await status.json(), { available: false, dailyLimit: 10, creditCost: 10, requiresAuth: true });
    const response = await fetch(`${base}/public/svg-generator`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(options) });
    assert.equal(response.status, 503);
  });
  assert.equal(calls, 0);
});
test('authenticated prompt endpoint validates input and enforces its limit before AI invocation', async () => {
  let calls = 0;
  await withServer(paidRouter('key', async () => { calls++; return renderSvgScene(scene, options); }), async base => {
    const request = body => fetch(`${base}/public/svg-generator`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.15' }, body: JSON.stringify(body) });
    assert.equal((await request({ ...options, prompt: 'x' })).status, 400);
    for (let index = 0; index < 10; index++) assert.equal((await request(paidOptions)).status, 200);
    const limited = await request(paidOptions);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    assert.equal(calls, 10);
    const otherClient = await fetch(`${base}/ai/svg-generator`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.16' }, body: JSON.stringify(paidOptions) });
    assert.equal(otherClient.status, 429); // Changing IP cannot bypass an account's limit.
    assert.equal(calls, 10);
  });
});

const postPaid = (base, body = paidOptions, path = '/ai/svg-generator') => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
test('both new and legacy generation URLs require authentication before any AI or credit work', async () => {
  let work = 0;
  await withServer(createSvgPromptRouter('key', async () => { work++; }, { pricing: async () => { work++; } }), async base => {
    for (const path of ['/ai/svg-generator', '/public/svg-generator']) assert.equal((await postPaid(base, paidOptions, path)).status, 401);
  });
  assert.equal(work, 0);
});

test('charges the server price once and records usage only after a successful SVG', async () => {
  const events = [];
  await withServer(paidRouter('key', async () => { events.push('generate'); return renderSvgScene(scene, options); }, {
    reserve: async (_id, cost) => { events.push(`reserve:${cost}`); return cost; },
    complete: async (_id, cost) => { events.push(`complete:${cost}`); },
    refund: async () => { events.push('refund'); },
  }), async base => {
    const response = await postPaid(base, { ...paidOptions, creditCost: 0, creditsUsed: 0, isAdmin: true });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).creditsUsed, 10);
  });
  assert.deepEqual(events, ['reserve:10', 'generate', 'complete:10']);
});

test('insufficient credits, disabled tool and stale/missing prices never invoke AI', async () => {
  let calls = 0;
  const generate = async () => { calls++; return renderSvgScene(scene, options); };
  await withServer(paidRouter('key', generate, { reserve: async () => { throw new (await import('../dist/lib/svgPromptAi.js')).SvgGenerationError('Brak kredytów', 402); } }), async base => {
    assert.equal((await postPaid(base)).status, 402);
    assert.equal((await postPaid(base, { ...paidOptions, expectedCreditCost: 0 })).status, 409);
    assert.equal((await postPaid(base, options)).status, 409);
  });
  await withServer(paidRouter('key', generate, { pricing: async () => ({ active: false, creditCost: 10 }) }), async base => {
    assert.equal((await postPaid(base)).status, 503);
    assert.equal((await (await fetch(`${base}/public/svg-generator`)).json()).available, false);
  });
  assert.equal(calls, 0);
});

test('provider and usage-record failures refund reserved credits once', async () => {
  for (const failedStep of ['provider', 'usage']) {
    let refunded = 0;
    await withServer(paidRouter('key', async () => { if (failedStep === 'provider') throw new Error('offline'); return renderSvgScene(scene, options); }, {
      complete: async () => { throw new Error('database unavailable'); },
      refund: async (_id, cost) => { refunded += cost; },
    }), async base => { assert.equal((await postPaid(base)).status, 502); });
    assert.equal(refunded, 10);
  }
});

test('disconnect during provider work cancels AI and refunds the reservation', async () => {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let refunded;
  const refundDone = new Promise(resolve => { refunded = resolve; });
  await withServer(paidRouter('key', async (_options, _key, signal) => {
    started();
    await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  }, { refund: async (_id, cost) => { assert.equal(cost, 10); refunded(); } }), async base => {
    const controller = new AbortController();
    const request = fetch(`${base}/ai/svg-generator`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(paidOptions), signal: controller.signal }).catch(() => {});
    await ready; controller.abort(); await request; await refundDone;
  });
});

test('administrator exemption reports zero credits and does not invent a paid usage entry', async () => {
  let recorded = -1;
  await withServer(paidRouter('key', async () => renderSvgScene(scene, options), { reserve: async () => 0, complete: async (_id, cost) => { recorded = cost; } }), async base => {
    assert.equal((await (await postPaid(base)).json()).creditsUsed, 0);
  });
  assert.equal(recorded, 0);
});
