import { createMeteredAdClient } from '../lib/adUsage.js';
import { adWeeklyStore, adQuotaSubjects } from '../lib/adWeeklyAccess.js';
import { adQuotaBlocked } from '../lib/adQuotaResponse.js';
import { Router, type RequestHandler, type Request } from "express";
import sharp from "sharp";
import { env } from "../config/env.js";
import { createLocalAdPromptSession, listLocalAdPromptSessions } from "../lib/localAdPromptData.js";
import { requireAdGeneratorAccess } from "../middleware/requireAdGeneratorAccess.js";
import { createRateLimitMiddleware } from '../middleware/rateLimit.js';
import { requireAuthenticatedUser } from "../middleware/requireAuthenticatedUser.js";
import { AD_PROMPT_MODEL, AdBriefError, AdProviderError, generateAdCampaign, type AdImage } from "../lib/adCreativeAi.js";
import { readCampaignOptions } from '../lib/adResearch.js';
import { createAdResearchRouter } from './adResearch.js';

const MAX_IMAGES = 6;
const MAX_DESCRIPTION_LENGTH = 12000;
const MAX_TOTAL_IMAGE_LENGTH = 14 * 1024 * 1024;
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const activeUsers = new Set<string>();

function readInput(body: Record<string, unknown>): { description: string; images: AdImage[] } {
  const description = typeof body.text === "string" ? body.text.trim() : "";
  if (description.length > MAX_DESCRIPTION_LENGTH) throw new Error("Opis może mieć maksymalnie 12 000 znaków.");
  if (body.images !== undefined && !Array.isArray(body.images)) throw new Error("Nieprawidłowa lista zdjęć.");
  const inputImages = Array.isArray(body.images) ? body.images : [];
  if (inputImages.length > MAX_IMAGES) throw new Error("Dodaj maksymalnie 6 zdjęć.");
  const images: AdImage[] = inputImages.map(image => {
    const mediaType = typeof image?.mediaType === "string" ? image.mediaType.toLowerCase() : "";
    const data = typeof image?.data === "string" ? image.data.replace(/^data:[^;]+;base64,/i, "").trim() : "";
    if (!MEDIA_TYPES.has(mediaType) || !data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error("Dodaj poprawne zdjęcie JPG, PNG, WebP lub HEIC.");
    return { mediaType, data };
  });
  if (images.reduce((sum, image) => sum + image.data.length, 0) > MAX_TOTAL_IMAGE_LENGTH) throw new Error("Zdjęcia są za duże. Zmniejsz je lub dodaj mniej plików.");
  if (!description && !images.length) throw new Error("Opisz ofertę lub dodaj zdjęcie.");
  return { description, images };
}

type Dependencies = {
  authenticate: RequestHandler;
  quota: typeof adWeeklyStore;
  subjects: (request: Request) => string[];
  apiKey: () => string;
  generate: (userId: string, description: string, images: AdImage[], signal: AbortSignal, options: ReturnType<typeof readCampaignOptions>) => ReturnType<typeof generateAdCampaign>;
  save: typeof createLocalAdPromptSession;
  latest: typeof listLocalAdPromptSessions;
};
export function createAdPromptGeneratorRouter(overrides: Partial<Dependencies> = {}) {
const deps: Dependencies = {
  authenticate: requireAuthenticatedUser, quota: adWeeklyStore, subjects: adQuotaSubjects, apiKey: () => env.openAiApiKey,
  generate: (id, description, images, signal, options) => generateAdCampaign(createMeteredAdClient(env.openAiApiKey, id, 'campaign'), description, images, signal, options),
  save: createLocalAdPromptSession, latest: listLocalAdPromptSessions, ...overrides,
};
const adPromptGeneratorRouter = Router();
adPromptGeneratorRouter.use(createAdResearchRouter());
adPromptGeneratorRouter.get('/ad-generator/access', deps.authenticate, requireAdGeneratorAccess, async (req, res) => {
  try {
    const keys = deps.subjects(req);
    const [campaign, research, sessions] = await Promise.all([deps.quota.status('campaign', keys), deps.quota.status('research', keys), deps.latest(req.authUser!.id, 1)]);
    const last = sessions[0];
    res.json({ campaign, research, lastSession: last ? { id: last.id, inputText: last.input_text, prompts: last.prompts, createdAt: last.created_at } : null });
  } catch { res.status(503).json({ error: 'Nie udało się sprawdzić limitu. Odśwież dostęp przed generowaniem.' }); }
});

const generationRate = createRateLimitMiddleware({ scope: 'ad-generator', max: 20, windowMs: 15 * 60 * 1000, message: 'Zbyt wiele analiz reklam. Spróbuj ponownie za kilka minut.', keyResolver: req => [req.authUser!.id] });
adPromptGeneratorRouter.post("/ad-generator/generate", deps.authenticate, requireAdGeneratorAccess, generationRate, async (req, res) => {
  const user = req.authUser!;
  let locked = false;
  const controller = new AbortController();
  const onClose = () => { if (!res.writableEnded) controller.abort(); };
  res.on("close", onClose);
  const timeout = setTimeout(() => controller.abort(), 220_000);
  try {
    if (!deps.apiKey()) return res.status(503).json({ error: "Generator reklam wymaga skonfigurowanego klucza OpenAI." });
    let input: ReturnType<typeof readInput>;
    let options: ReturnType<typeof readCampaignOptions>;
    try {
      input = readInput(req.body || {});
      options = readCampaignOptions(req.body || {});
      // OpenAI accepts JPEG/PNG/WebP, so convert HEIC rather than sending an unsupported MIME type.
      input.images = await Promise.all(input.images.map(async image => {
        if (image.mediaType !== 'image/heic' && image.mediaType !== 'image/heif') return image;
        try {
          const data = await sharp(Buffer.from(image.data, 'base64'), { limitInputPixels: 40_000_000 }).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
          return { data: data.toString('base64'), mediaType: 'image/jpeg' };
        } catch { throw new Error('Nie udało się odczytać zdjęcia HEIC. Dodaj je jako JPG lub PNG.'); }
      }));
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Sprawdź opis i zdjęcia." });
    }
    if (activeUsers.has(user.id)) return res.status(409).json({ error: "Twoje reklamy są już przygotowywane. Poczekaj na zakończenie analizy." });
    activeUsers.add(user.id);
    locked = true;
    controller.signal.throwIfAborted();
    const quota = await deps.quota.consume('campaign', deps.subjects(req));
    if (!quota.claimed) return adQuotaBlocked(res, quota);
    const result = await deps.generate(user.id, input.description, input.images, controller.signal, options);
    const session = await deps.save({ userId: user.id, inputText: input.description, imageCount: input.images.length, prompts: result.prompts }).catch(() => null);
    return res.json({
      ok: true, ...result, quota, creditsUsed: 0, model: AD_PROMPT_MODEL,
      session: session ? { id: session.id, inputText: session.input_text, imageCount: session.image_count, prompts: session.prompts, createdAt: session.created_at } : null,
    });
  } catch (error) {
    if (error instanceof AdBriefError && !res.destroyed) return res.status(422).json({ error: error.message });
    console.error("[ad-generator] failed", { kind: error instanceof Error ? error.name : "unknown", aborted: controller.signal.aborted, providerStatus: error instanceof AdProviderError ? error.status : undefined, providerCode: error instanceof AdProviderError ? error.code : undefined });
    if (!res.destroyed) return res.status(502).json({
      error: controller.signal.aborted
        ? "Analiza trwała zbyt długo. Materiały pozostały w formularzu. Rozpoczęta próba zużyła limit tygodniowy."
        : error instanceof AdProviderError && error.code === 'insufficient_quota'
          ? "Limit rozliczeniowy OpenAI został wyczerpany. Administrator musi sprawdzić saldo API; Twoje materiały zostały zachowane."
        : error instanceof AdProviderError && (error.code === 'model_not_found' || error.status === 403)
          ? "Model GPT-5.6 Luna nie jest dostępny dla skonfigurowanego konta OpenAI. Administrator musi sprawdzić dostęp do modelu."
        : error instanceof AdProviderError && error.status === 429
          ? "Usługa AI ma obecnie ograniczoną dostępność. Materiały pozostały w formularzu. Sprawdź datę kolejnej próby."
          : "Nie udało się przygotować reklam. Materiały zostały zachowane. Sprawdź datę kolejnej próby.",
    });
  } finally {
    clearTimeout(timeout);
    res.off("close", onClose);
    if (locked) activeUsers.delete(user.id);
  }
});

return adPromptGeneratorRouter;
}
export const adPromptGeneratorRouter = createAdPromptGeneratorRouter();
