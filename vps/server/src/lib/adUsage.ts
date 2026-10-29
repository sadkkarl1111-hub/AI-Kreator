import { randomUUID } from 'node:crypto';
import { createAdJsonClient, AD_PROMPT_MODEL, type AdJsonClient, type AdTokenUsage } from './adCreativeAi.js';
import { getPostgresPool } from './postgres.js';
import type { AdQuotaScope } from './adWeeklyAccess.js';
import { MAX_COUPON_DISCOUNT_PERCENT } from './couponLimits.js';

// Standard API list prices verified 2026-10-25; estimates are distinct from the provider invoice.
// https://developers.openai.com/api/docs/models/gpt-5.6-sol and /gpt-5.6-luna
export const AD_TOKEN_RATES: Record<string, { input: number; cached: number; output: number; cacheWrite: number }> = {
  'gpt-5.6-sol': { input: 4, cached: 0.4, output: 20, cacheWrite: 5 },
  'gpt-5.6-luna': { input: 0.2, cached: 0.02, output: 1.2, cacheWrite: 0.25 },
};
const count = (value: number | undefined) => Number.isSafeInteger(value) && value! >= 0 ? value! : 0;
export function estimateAdCost(model: string, usage: AdTokenUsage) {
  const rates = AD_TOKEN_RATES[model]; if (!rates) return null;
  const input = count(usage.inputTokens), cached = Math.min(input, count(usage.cachedInputTokens));
  const written = Math.min(input - cached, count(usage.cacheWriteTokens));
  // Reasoning tokens are already included in output_tokens, never bill them a second time.
  return ((input - cached - written) * rates.input + cached * rates.cached + written * rates.cacheWrite + count(usage.outputTokens) * rates.output) / 1_000_000;
}
type Call = { id: string; userId: string; scope: AdQuotaScope; model: string };
type Writer = { start: (call: Call) => Promise<void>; finish: (call: Call, status: 'completed' | 'failed', usage: AdTokenUsage | null) => Promise<void> };
const writer: Writer = {
  async start(call) {
    await getPostgresPool().query(`INSERT INTO ad_ai_usage(id,user_id,scope,model,rates,min_credit_value_pln)
      VALUES($1,$2,$3,$4,$5::jsonb,(SELECT min(price_grosze::numeric/100/credits)*(1-$6::numeric/100) FROM credit_packages WHERE active AND credits>0 AND price_grosze>0))`,
    [call.id, call.userId, call.scope, call.model, JSON.stringify(AD_TOKEN_RATES[call.model] || {}), MAX_COUPON_DISCOUNT_PERCENT]);
  },
  async finish(call, status, usage) {
    await getPostgresPool().query(`UPDATE ad_ai_usage SET status=$2,usage_available=$3,input_tokens=$4,cached_input_tokens=$5,cache_write_tokens=$6,output_tokens=$7,reasoning_tokens=$8,estimated_cost_usd=$9,finished_at=now() WHERE id=$1`,
      [call.id, status, Boolean(usage), usage?.inputTokens ?? null, usage?.cachedInputTokens ?? null, usage?.cacheWriteTokens ?? null, usage?.outputTokens ?? null, usage?.reasoningTokens ?? null, usage ? estimateAdCost(call.model, usage) : null]);
  },
};
export function createMeteredAdClient(apiKey: string, userId: string, scope: AdQuotaScope, log: Writer = writer, makeClient = createAdJsonClient): AdJsonClient {
  return async request => {
    const call = { id: randomUUID(), userId, scope, model: request.model || AD_PROMPT_MODEL.id };
    await log.start(call); // If accounting is unavailable, do not incur an unrecorded provider request.
    let usage: AdTokenUsage | null = null, status: 'completed' | 'failed' = 'failed';
    try { const result = await makeClient(apiKey, value => { usage = value; })(request); status = 'completed'; return result; }
    finally { await log.finish(call, status, usage).catch(error => console.error('[ad-usage] finish failed', { callId: call.id, kind: error instanceof Error ? error.name : 'unknown' })); }
  };
}
