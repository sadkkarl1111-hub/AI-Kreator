import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createCarouselImageRouter } from '../dist/routes/carouselImage.js';

const paid = { allowed: true, isAdmin: false, balance: 100 };
const body = { prompt: 'Fioletowa żarówka 3D', model: 'test-model', expectedCreditCost: 25, style: 'illustration', dimensions: '1024x1024' };
async function withApi(overrides, action) {
  let calls = 0, passed;
  const app = express(); app.use(express.json());
  app.use(createCarouselImageRouter([(request, response) => { calls++; passed = request.body; response.json({ imageUrl: 'https://images.test/result.png' }); }], {
    authenticate: (request, _response, next) => { request.authUser = { id: 'user', email: null }; next(); },
    access: async userId => { assert.equal(userId, 'user'); return paid; },
    models: async () => [{ id: 'test-model', label: 'Test', cost: 25 }],
    ...overrides,
  }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = data => fetch(`${base}/ai/carousel-image`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  try { await action({ base, post, calls: () => calls, passed: () => passed }); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('requires authentication for both carousel access and generation', async () => {
  await withApi({ authenticate: (_req, response) => response.status(401).json({ error: 'auth' }) }, async ({ base, post, calls }) => {
    assert.equal((await fetch(`${base}/ai/carousel-generator`)).status, 401);
    assert.equal((await post(body)).status, 401); assert.equal(calls(), 0);
  });
});
test('free account cannot unlock generation using a paid flag, positive balance or arbitrary tool pricing', async () => {
  await withApi({ access: async () => ({ allowed: false, isAdmin: false, balance: 9999 }) }, async ({ base, post, calls }) => {
    const status = await fetch(`${base}/ai/carousel-generator`);
    assert.equal(status.headers.get('cache-control'), 'no-store'); assert.equal((await status.json()).allowed, false);
    assert.equal((await post({ ...body, paid: true, isAdmin: true, toolId: 'carousel', expectedCreditCost: 0 })).status, 403);
    assert.equal(calls(), 0);
  });
});
test('returns current entitlement, balance and model prices', async () => {
  await withApi({}, async ({ base }) => {
    assert.deepEqual(await (await fetch(`${base}/ai/carousel-generator`)).json(), { ...paid, models: [{ id: 'test-model', label: 'Test', cost: 25 }] });
  });
});
test('paid generation forwards the original prompt and exactly one image to the shared billing handler', async () => {
  await withApi({}, async ({ post, calls, passed }) => {
    const response = await post({ ...body, count: 4, referenceImagePaths: ['other-user/private.png'], toolId: 'free-tool', companyAssistantContext: { sessionId: 'other' } });
    assert.equal(response.status, 200); assert.equal(calls(), 1);
    assert.deepEqual(passed(), { ...body, count: 1 });
    assert.ok((await response.json()).imageUrl);
  });
});
test('rejects stale or omitted prices, unknown models and invalid prompt before generation', async () => {
  await withApi({}, async ({ post, calls }) => {
    for (const expectedCreditCost of [0, 24, '25', undefined]) assert.equal((await post({ ...body, expectedCreditCost })).status, 409);
    assert.equal((await post({ ...body, model: 'inactive' })).status, 400);
    for (const prompt of ['', '  x ', 'x'.repeat(2001), {}]) assert.equal((await post({ ...body, prompt })).status, 400);
    assert.equal(calls(), 0);
  });
});
test('rechecks paid entitlement and price for every request, including after a previous allowed status', async () => {
  let allowed = true, price = 25;
  await withApi({ access: async () => ({ ...paid, allowed }), models: async () => [{ id: 'test-model', label: 'Test', cost: price }] }, async ({ base, post, calls }) => {
    assert.equal((await (await fetch(`${base}/ai/carousel-generator`)).json()).allowed, true);
    allowed = false; assert.equal((await post(body)).status, 403);
    allowed = true; price = 30; assert.equal((await post(body)).status, 409); assert.equal(calls(), 0);
  });
});
test('paid accounts need sufficient credits while administrators use the same generation path', async () => {
  await withApi({ access: async () => ({ ...paid, balance: 24 }) }, async ({ post, calls }) => { assert.equal((await post(body)).status, 429); assert.equal(calls(), 0); });
  await withApi({ access: async () => ({ ...paid, isAdmin: true, balance: 0 }) }, async ({ post, calls }) => { assert.equal((await post(body)).status, 200); assert.equal(calls(), 1); });
});
test('fails closed when entitlement lookup is unavailable', async () => {
  await withApi({ access: async () => { throw new Error('simulated unavailable membership lookup'); } }, async ({ base, post, calls }) => {
    assert.equal((await fetch(`${base}/ai/carousel-generator`)).status, 503);
    assert.equal((await post(body)).status, 503); assert.equal(calls(), 0);
  });
});
