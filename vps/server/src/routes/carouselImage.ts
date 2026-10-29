import { Router, type RequestHandler } from "express";
import { listLocalCreditPurchases } from "../lib/localBillingData.js";
import { listLocalAiModels } from "../lib/localCoreData.js";
import { getLocalUserCredit, hasLocalUserRole } from "../lib/localUserData.js";
import { requireAuthenticatedUser } from "../middleware/requireAuthenticatedUser.js";

type Access = { allowed: boolean; isAdmin: boolean; balance: number };
type Model = { id: string; label: string; cost: number };
type Dependencies = {
  authenticate: RequestHandler;
  access: (userId: string) => Promise<Access>;
  models: () => Promise<Model[]>;
};

const dependencies: Dependencies = {
  authenticate: requireAuthenticatedUser,
  access: async userId => {
    const [isAdmin, purchases, credit] = await Promise.all([
      hasLocalUserRole(userId, "admin"),
      listLocalCreditPurchases({ userId, status: "completed", limit: 1 }),
      getLocalUserCredit(userId),
    ]);
    return { allowed: isAdmin || purchases.length > 0, isAdmin, balance: credit?.balance ?? 0 };
  },
  models: async () => (await listLocalAiModels()).filter(row => row.active && row.supports_generation).map(row => ({
    id: row.model_id, label: row.name, cost: row.credit_cost || 50,
  })),
};

// The dedicated route enforces membership independently of client flags. Generation,
// atomic credit reservation/refund, concurrency limits and gallery storage stay shared.
export function createCarouselImageRouter(generate: RequestHandler[], overrides: Partial<Dependencies> = {}) {
  const deps = { ...dependencies, ...overrides }, router = Router();
  router.get("/ai/carousel-generator", deps.authenticate, async (request, response) => {
    response.set("Cache-Control", "no-store");
    try {
      const [access, models] = await Promise.all([deps.access(request.authUser!.id), deps.models()]);
      response.json({ ...access, models });
    } catch (error) {
      console.error("Carousel generator status failed:", error);
      response.status(503).json({ error: "Nie udało się sprawdzić dostępu do generatora. Spróbuj ponownie." });
    }
  });
  router.post("/ai/carousel-image", deps.authenticate, async (request, response, next) => {
    try {
      const access = await deps.access(request.authUser!.id);
      if (!access.allowed) {
        response.status(403).json({ error: "Generator karuzel jest dostępny po zakupie płatnego pakietu." }); return;
      }
      const body = request.body || {}, prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      const model = (await deps.models()).find(row => row.id === body.model);
      if (prompt.length < 3 || prompt.length > 2000) {
        response.status(400).json({ error: "Opis powinien mieć od 3 do 2000 znaków." }); return;
      }
      if (!model) { response.status(400).json({ error: "Wybrany model jest niedostępny. Odśwież dostęp." }); return; }
      if (body.expectedCreditCost !== model.cost) {
        response.status(409).json({ error: "Cena modelu się zmieniła. Odśwież dostęp i sprawdź koszt." }); return;
      }
      if (!access.isAdmin && access.balance < model.cost) {
        response.status(429).json({ error: "Brak wystarczających kredytów. Doładuj je w zakładce Kredyty." }); return;
      }
      // Explicit allowlist: a carousel request generates exactly one image and cannot
      // override pricing, reference other accounts' media or write company assets.
      request.body = { prompt, model: model.id, expectedCreditCost: model.cost, count: 1, style: body.style, dimensions: body.dimensions };
      next();
    } catch (error) {
      console.error("Carousel generator access failed:", error);
      response.status(503).json({ error: "Nie udało się sprawdzić dostępu. Spróbuj ponownie." });
    }
  }, ...generate);
  return router;
}
