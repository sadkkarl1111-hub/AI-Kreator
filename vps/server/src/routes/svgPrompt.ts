import { Router, type Request, type RequestHandler } from "express";
import { isIP } from "node:net";
import { createRateLimitMiddleware } from "../middleware/rateLimit.js";
import { generatePromptSvg, parseSvgPromptOptions, SvgGenerationError } from "../lib/svgPromptAi.js";
import { requireAuthenticatedUser } from "../middleware/requireAuthenticatedUser.js";
import { svgPromptBilling } from "../lib/svgPromptBilling.js";

export function getSvgClientIp(request: Request) {
  // Apache and nginx append the actual client address last; client-supplied leading entries are untrusted.
  const forwarded = request.header("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded && isIP(forwarded) ? forwarded : request.socket.remoteAddress || "local";
}

export function createSvgPromptRouter(apiKey: string, generate = generatePromptSvg, billing = svgPromptBilling, authenticate: RequestHandler = requireAuthenticatedUser) {
  const router = Router();
  let active = 0;
  const limit = createRateLimitMiddleware({ scope: "svg-prompt-ip", max: 10, windowMs: 86400000, message: "Wykorzystano limit 10 prób na 24 godziny. Poczekaj na odnowienie limitu lub skorzystaj z szablonów.", keyResolver: request => [getSvgClientIp(request)] });
  const globalLimit = createRateLimitMiddleware({ scope: "svg-prompt-global", max: 100, windowMs: 86400000, message: "Limit generatora został wyczerpany. Poczekaj na odnowienie limitu lub skorzystaj z szablonów.", keyResolver: () => ["all"] });
  const userLimit = createRateLimitMiddleware({ scope: "svg-prompt-user", max: 10, windowMs: 86400000, message: "Wykorzystano limit 10 prób na 24 godziny. Skorzystaj z darmowych szablonów lub poczekaj na odnowienie limitu.", keyResolver: request => [request.authUser!.id] });

  router.get("/public/svg-generator", async (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    try {
      const pricing = await billing.pricing();
      response.json({ available: Boolean(apiKey) && pricing.active, dailyLimit: 10, creditCost: pricing.creditCost, requiresAuth: true });
    } catch {
      response.status(503).json({ error: "Nie udało się pobrać cennika generatora SVG. Spróbuj ponownie." });
    }
  });
  // The legacy public URL is also authenticated: old clients cannot bypass billing.
  router.post(["/ai/svg-generator", "/public/svg-generator"], authenticate, (request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    try {
      response.locals.svgOptions = parseSvgPromptOptions(request.body);
      if (!apiKey) throw new SvgGenerationError("Generator AI nie został jeszcze uruchomiony. Skorzystaj z szablonów lub biblioteki SVG.", 503);
      next();
    } catch (error) { response.status(error instanceof SvgGenerationError ? error.status : 400).json({ error: error instanceof Error ? error.message : "Sprawdź opis grafiki." }); }
  }, userLimit, limit, globalLimit, async (request, response) => {
    if (active >= 2) {
      response.setHeader("Retry-After", "15");
      response.status(503).json({ error: "Generator jest zajęty. Spróbuj ponownie za kilkanaście sekund." });
      return;
    }
    active += 1;
    const userId = request.authUser!.id;
    let reservedCost = 0;
    let usageCompleted = false;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    request.on("aborted", cancel);
    response.on("close", cancel);
    try {
      const pricing = await billing.pricing();
      if (!pricing.active) throw new SvgGenerationError("Generator SVG jest obecnie wyłączony.", 503);
      if (request.body.expectedCreditCost !== pricing.creditCost) {
        throw new SvgGenerationError("Cena generatora uległa zmianie. Odśwież stronę i sprawdź aktualny koszt.", 409);
      }
      controller.signal.throwIfAborted();
      reservedCost = await billing.reserve(userId, pricing.creditCost);
      controller.signal.throwIfAborted();
      const result = await generate(response.locals.svgOptions, apiKey, controller.signal);
      controller.signal.throwIfAborted();
      await billing.complete(userId, reservedCost, controller.signal);
      usageCompleted = true;
      response.json({ ...result, creditsUsed: reservedCost });
      reservedCost = 0;
    } catch (error) {
      // Refund before reporting failure so the next balance refresh reflects it.
      if (reservedCost > 0 && !usageCompleted) {
        await billing.refund(userId, reservedCost).then(() => { reservedCost = 0; }).catch(refundError => {
          console.error("SVG credit refund failed", { userId, cost: reservedCost, error: refundError instanceof Error ? refundError.message : String(refundError) });
        });
      }
      if (!controller.signal.aborted) {
        const status = error instanceof SvgGenerationError ? error.status : 502;
        if (status === 429) response.setHeader("Retry-After", "60");
        response.status(status).json({ error: error instanceof SvgGenerationError ? error.message : "Nie udało się wygenerować SVG. Spróbuj ponownie." });
      }
    } finally {
      active -= 1;
      request.off("aborted", cancel);
      response.off("close", cancel);
    }
  });
  return router;
}

// A dedicated free-tier key is the default. Reusing a billed key requires an explicit operator choice.
const apiKey = process.env.SVG_GEMINI_API_KEY?.trim() || (process.env.SVG_AI_USE_EXISTING_GEMINI === "true" ? process.env.GEMINI_API_KEY?.trim() : "") || "";
export const svgPromptRouter = createSvgPromptRouter(apiKey);
