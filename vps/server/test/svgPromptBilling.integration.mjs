// Explicit opt-in: uses a disposable account in the configured PostgreSQL database.
// RUN_SVG_BILLING_LIVE=true additionally makes one real, paid provider call.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { createSvgPromptRouter } from '../dist/routes/svgPrompt.js';
import { svgPromptBilling } from '../dist/lib/svgPromptBilling.js';
import { ensureLocalDatabaseSchema, getPostgresPool } from '../dist/lib/postgres.js';
import { issueLocalAccessToken } from '../dist/lib/localAuth.js';

if (process.env.RUN_SVG_BILLING_INTEGRATION !== 'true') throw new Error('Explicit integration-test opt-in required.');
await ensureLocalDatabaseSchema();
const pool = getPostgresPool();
const userId = randomUUID();
const token = issueLocalAccessToken({ userId, email: null, expiresIn: 300 });
const { creditCost: cost, active } = await svgPromptBilling.pricing();
assert.ok(active && cost > 0);
const body = { prompt: 'Ikona koszyka sklepowego z sercem, fioletowy obrys, bez napisów', style: 'icon', width: 1024, height: 1024, transparent: true, background: '#ffffff', expectedCreditCost: cost };
const result = { svg: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="20"/></svg>', title: 'Test', width: 1024, height: 1024 };
const balance = async () => Number((await pool.query('SELECT balance FROM user_credits WHERE user_id = $1', [userId])).rows[0]?.balance);
const resetBalance = async value => pool.query('UPDATE user_credits SET balance = $2 WHERE user_id = $1', [userId, value]);
const usage = async () => Number((await pool.query('SELECT COALESCE(SUM(credits_used), 0) AS total FROM credit_usage WHERE user_id = $1', [userId])).rows[0].total);
const post = (base, signal) => fetch(`${base}/ai/svg-generator`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal });
async function serverWith(generate, action, billing = svgPromptBilling) {
  const app = express(); app.use(express.json()); app.use(createSvgPromptRouter('test-key', generate, billing));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
try {
  await pool.query('INSERT INTO auth_users (user_id, email_confirmed_at) VALUES ($1, now())', [userId]);
  await pool.query('INSERT INTO user_credits (user_id, balance) VALUES ($1, $2)', [userId, cost]);
  await serverWith(async () => result, async base => {
    const response = await post(base); assert.equal(response.status, 200);
    assert.equal((await response.json()).creditsUsed, cost);
    assert.equal(await balance(), 0); assert.equal(await usage(), cost);
  });
  console.log('PASS real authentication, debit and usage history');

  await resetBalance(cost);
  let calls = 0;
  await serverWith(async () => { calls++; await new Promise(resolve => setTimeout(resolve, 100)); return result; }, async base => {
    const responses = await Promise.all([post(base), post(base)]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 402]);
    assert.equal(await balance(), 0); assert.equal(calls, 1); assert.equal(await usage(), cost * 2);
  });
  console.log('PASS concurrent requests cannot spend the same balance twice');

  for (const failedStep of ['provider', 'usage']) {
    await resetBalance(cost);
    await serverWith(async () => { if (failedStep === 'provider') throw new Error('test provider failure'); return result; }, async base => {
      assert.equal((await post(base)).status, 502);
      assert.equal(await balance(), cost); assert.equal(await usage(), cost * 2);
    }, failedStep === 'usage' ? { ...svgPromptBilling, complete: async () => { throw new Error('test usage failure'); } } : svgPromptBilling);
  }
  console.log('PASS provider and accounting failures refund the real balance');

  let started, refunded;
  const ready = new Promise(resolve => { started = resolve; });
  const refundDone = new Promise(resolve => { refunded = resolve; });
  await serverWith(async (_options, _key, signal) => {
    started(); await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  }, async base => {
    const controller = new AbortController();
    const pending = post(base, controller.signal).catch(() => {});
    await ready; controller.abort(); await pending;
    await Promise.race([refundDone, new Promise((_, reject) => setTimeout(() => reject(new Error('refund timed out')), 5000).unref())]);
    assert.equal(await balance(), cost); assert.equal(await usage(), cost * 2);
  }, { ...svgPromptBilling, refund: async (id, value) => { await svgPromptBilling.refund(id, value); refunded(); } });
  console.log('PASS disconnect refunds the real balance');

  await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')", [userId]);
  await serverWith(async () => result, async base => {
    assert.equal((await (await post(base)).json()).creditsUsed, 0);
    assert.equal(await balance(), cost); assert.equal(await usage(), cost * 2);
  });
  await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  console.log('PASS administrator exemption comes from the database');

  if (process.env.RUN_SVG_BILLING_LIVE === 'true') {
    const response = await post('http://127.0.0.1:3000');
    const generated = await response.json();
    assert.equal(response.status, 200, generated.error);
    assert.match(generated.svg, /<svg/); assert.equal(generated.creditsUsed, cost);
    assert.equal(await balance(), 0); assert.equal(await usage(), cost * 3);
    console.log('PASS live paid SVG generation: one debit and matching history entry');
  }
} finally {
  for (const table of ['credit_usage', 'user_roles', 'user_credits', 'auth_users']) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
  await pool.end();
  console.log('Disposable test account and its records removed');
}
