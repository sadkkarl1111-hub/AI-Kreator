import { randomUUID } from "node:crypto";
import { listLocalToolPricing } from "./localCoreData.js";
import { addLocalUserCreditsBalance, deductLocalUserCreditsBalance, hasLocalUserRole } from "./localUserData.js";
import { getPostgresPool } from "./postgres.js";
import { SvgGenerationError } from "./svgPromptAi.js";

export const SVG_TOOL_ID = "svg-generator";
export type SvgPricing = { active: boolean; creditCost: number };

export const svgPromptBilling = {
  async pricing(): Promise<SvgPricing> {
    const tool = (await listLocalToolPricing()).find(row => row.tool_id === SVG_TOOL_ID);
    if (!tool || !Number.isSafeInteger(tool.credit_cost) || tool.credit_cost < 0) {
      throw new SvgGenerationError("Cennik generatora SVG jest chwilowo niedostępny.", 503);
    }
    return { active: tool.active, creditCost: tool.credit_cost };
  },
  async reserve(userId: string, cost: number) {
    // Administrators use the same exemption as the other paid AI tools.
    if (await hasLocalUserRole(userId, "admin") || cost === 0) return 0;
    if (!await deductLocalUserCreditsBalance(userId, cost)) {
      throw new SvgGenerationError("Brak wystarczającej liczby kredytów. Doładuj konto w zakładce Kredyty.", 402);
    }
    return cost;
  },
  async complete(userId: string, cost: number, signal: AbortSignal) {
    signal.throwIfAborted();
    if (cost === 0) return;
    const client = await getPostgresPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO credit_usage (id, user_id, credits_used, model, created_at) VALUES ($1, $2, $3, $4, now())", [randomUUID(), userId, cost, SVG_TOOL_ID]);
      signal.throwIfAborted();
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  },
  async refund(userId: string, cost: number) {
    if (cost > 0) await addLocalUserCreditsBalance(userId, cost);
  },
};
