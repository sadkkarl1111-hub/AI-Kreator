import { assertImageBackground, imageBackgroundPrompt, resolveImageBackground, type ImageBackground } from "../lib/imageBackground.js";
import { randomUUID } from "node:crypto";
import { Router, type RequestHandler } from "express";
import { createCarouselImageRouter } from "./carouselImage.js";
import sharp from "sharp";
import { AD_IMAGE_QUALITY_LOCK, AD_REFERENCE_INSTRUCTIONS, isCompiledAdPrompt } from "../lib/adCreative.js";
import { env } from "../config/env.js";
import { deleteGraphicFile } from "../lib/graphics.js";
import { getLocalCreditUsageTotalSince, listLocalCreditPurchases, upsertLocalCreditUsageRows } from "../lib/localBillingData.js";
import {
  finishGenerationJob,
  GenerationConcurrencyError,
  reserveGenerationJob,
  type GenerationJobTier,
} from "../lib/generationJobs.js";
import { createLocalCompanyAssistantAsset } from "../lib/localCompanyAssistantData.js";
import { listLocalAiModels, listLocalToolPricing } from "../lib/localCoreData.js";
import {
  createLocalGraphic,
  deleteLocalGraphicsByIds,
  recordLocalGraphicHistoryEntry,
  trimLocalSavedGraphics,
} from "../lib/localGraphicsData.js";
import {
  storagePathToRelativePath,
} from "../lib/localFiles.js";
import { getStorageDisplayUrl, readStorageFile, writeStorageFile } from "../lib/storage.js";
import {
  addLocalUserCreditsBalance,
  deductLocalUserCreditsBalance,
  getLocalUserCredit,
  hasLocalUserRole,
} from "../lib/localUserData.js";
import { hasLocalDatabase } from "../lib/postgres.js";
import { requireAuthenticatedUser } from "../middleware/requireAuthenticatedUser.js";
import {
  createRateLimitMiddleware,
  getRequestClientIp,
} from "../middleware/rateLimit.js";

type ReferenceImage = {
  base64: string;
  mimeType: string;
};

type GeneratedImageResult = {
  base64: string;
  mimeType: string;
};

type GenerateImageBody = {
  background?: ImageBackground;
  expectedCreditCost?: number;
  prompt?: string;
  style?: string;
  dimensions?: string;
  referenceImagePaths?: string[];
  model?: string;
  toolId?: string;
  count?: number;
  companyAssistantContext?: {
    packageId?: string | null;
    sessionId?: string | null;
    materialId?: string;
    materialTitle?: string;
  };
};

type EditImageBody = {
  prompt?: string;
  imageBase64?: string;
  imageMimeType?: string;
  mimeType?: string;
  maskBase64?: string;
  dimensions?: string;
  model?: string;
  parentGraphicId?: string | null;
  toolId?: string;
};

type ImageToPromptBody = {
  imageBase64?: string;
  imageMimeType?: string;
  promptType?: string;
  outputLanguage?: string;
  toolId?: string;
};

type OcrBody = {
  imageBase64?: string;
  imageMimeType?: string;
};

class AiRouteError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const MAX_SAVED_GRAPHICS = 50;
const MAX_INPUT_IMAGE_BASE64_LENGTH = 18 * 1024 * 1024;
const MAX_REFERENCE_IMAGES_TOTAL_BASE64_LENGTH = 14 * 1024 * 1024;
const ALLOWED_IMAGE_DIMENSIONS = [
  "1024x1024",
  "1536x1024",
  "1920x1080",
  "1024x1536",
  "1024x1280",
  "1080x1350",
  "1792x1024",
  "1024x1792",
  "1080x1920",
] as const;
const STYLE_MAP: Record<string, string> = {
  realistic: "photorealistic, ultra detailed, high resolution photography",
  illustration: "digital illustration, vibrant colors, detailed artwork",
  abstract: "abstract art, creative composition, bold colors and shapes",
  "pixel-art": "pixel art style, retro gaming aesthetic, 8-bit graphics",
  watercolor: "watercolor painting, soft flowing colors, artistic brush strokes",
  neon: "neon glow effect, cyberpunk aesthetic, vibrant neon colors on dark background",
};
const PROMPT_TYPE_INSTRUCTIONS: Record<string, string> = {
  universal:
    "Write a detailed all-purpose image-generation prompt that recreates the visible subject, layout, style, text hierarchy, camera angle, lighting, colors, background, and intended use. If the image is commercial, advertising, ecommerce, social media, course, ebook, packaging, or a 3D mockup, use a structured production prompt.",
  product:
    "Write a premium ecommerce/product prompt. If the image shows an ebook, course cover, box, packaging, app screen, poster, label, or product mockup, describe the exact product type, front design, spine/side details, 3D perspective, shadows, reflections, studio lighting, typography, visible text, marketing style, and clean advertising composition.",
  social:
    "Write a social media and paid-ad prompt with strong visual hook, scroll-stopping composition, readable hierarchy, brand mood, clear focal point, polished lighting, and platform-ready framing.",
  logo:
    "Write a logo/brand prompt focused on symbol shape, typography, brand identity, composition, colors, negative space, and practical use on digital and print materials.",
  art:
    "Write an artistic recreation prompt focused on mood, medium, texture, composition, lighting, visual influences, palette, depth, atmosphere, and rendering technique.",
};
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  pl: "Write the generated prompt instructions in Polish. Keep all visible text from the image exactly in its original language, including Polish diacritics and capitalization.",
  en: "Write the generated prompt instructions in English. Keep all visible text from the image exactly in its original language, including Polish diacritics and capitalization.",
};
const IMAGE_TO_PROMPT_STRUCTURE_INSTRUCTION = [
  "Return only the final image-generation prompt, with no explanation before or after.",
  "Start with a direct imperative sentence such as: Create a realistic... / Create a premium... / Design a high-end...",
  "Do not merely describe what is in the image. Transform the image into a reusable generation prompt for producing a similar or improved asset.",
  "If the image contains readable text, transcribe it exactly and place it in quoted fields or section lines. Preserve hierarchy: title, subtitle, badge, footer, price, CTA, spine text, labels.",
  "If text is partially readable, include the legible parts and mark uncertain fragments as [unclear] instead of inventing exact words.",
  "For commercial/product/ebook/course/mockup images, use concise uppercase section labels where useful, for example: PRODUCT, TITLE, SUBTITLE, BOTTOM SECTION, STYLE, COLORS, COVER DESIGN, MOCKUP, SPINE TEXT, FORMAT.",
  "Include practical visual-generation details: object type, materials, typography weight, layout, perspective, background, shadows, reflections, camera framing, lighting, rendering quality, and brand aesthetic.",
  "For finance, trading, education, ecommerce, beauty, food, real estate, SaaS, or event designs, infer the market category and name the visual style precisely.",
  "Avoid vague filler like beautiful, nice, cool, eye-catching unless paired with concrete visual details.",
  "Do not include markdown fences, numbered alternatives, analysis, or commentary.",
].join(" ");
const IMAGE_TO_PROMPT_OUTPUT_TEMPLATE = [
  "Use this output shape whenever the image is commercial, product, ebook, course, box, cover, social ad, or marketing creative:",
  "Create a realistic premium [asset/product/mockup]...",
  "",
  "PRODUCT:",
  "[specific object type, e.g. premium ebook box mockup, digital course box, poster, product packaging]",
  "",
  "MAIN TEXT / TITLE:",
  "\"[exact visible title text]\"",
  "",
  "SUBTITLE / SUPPORTING TEXT:",
  "\"[exact visible subtitle text or [unclear]]\"",
  "",
  "BADGES / BOTTOM SECTION / CTA:",
  "\"[exact visible smaller text, prices, labels, CTA, footer text]\"",
  "",
  "STYLE:",
  "[market/category aesthetic, mood, visual tone, premium/commercial direction]",
  "",
  "COLORS:",
  "[background, accent colors, typography colors, gradients, glows]",
  "",
  "TYPOGRAPHY:",
  "[font weight, uppercase/lowercase, hierarchy, alignment, readability]",
  "",
  "DESIGN / COVER LAYOUT:",
  "[composition, background graphics, charts, icons, photos, overlays, spacing]",
  "",
  "MOCKUP / RENDER:",
  "[3D perspective, front/spine/side visibility, material, shadows, reflections, studio lighting]",
  "",
  "BACKGROUND:",
  "[isolated background or scene, surface, depth, clean white/black/gradient]",
  "",
  "FORMAT:",
  "[vertical/horizontal/square, centered composition, ad quality, high detail]",
  "",
  "NEGATIVE PROMPT:",
  "blurry text, misspelled text, warped letters, low resolution, messy layout, amateur design, distorted perspective, extra objects, watermark",
  "",
  "The final answer must be at least 900 characters for marketing/product assets and must include at least 8 meaningful sections if the image supports them.",
].join("\n");

export const aiRouter = Router();

const compactRateLimitKeys = (...values: Array<string | null | undefined>) =>
  values.filter((value): value is string => Boolean(value));

const aiGenerateRateLimit = createRateLimitMiddleware({
  scope: "ai:generate",
  max: 12,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele prob generowania. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) =>
    compactRateLimitKeys(`ip:${getRequestClientIp(request)}`, request.authUser?.id ? `user:${request.authUser.id}` : null),
});

const aiEditRateLimit = createRateLimitMiddleware({
  scope: "ai:edit",
  max: 10,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele prob edycji grafiki. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) =>
    compactRateLimitKeys(`ip:${getRequestClientIp(request)}`, request.authUser?.id ? `user:${request.authUser.id}` : null),
});

const aiVisionRateLimit = createRateLimitMiddleware({
  scope: "ai:vision",
  max: 20,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele prob analizy obrazu. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) =>
    compactRateLimitKeys(`ip:${getRequestClientIp(request)}`, request.authUser?.id ? `user:${request.authUser.id}` : null),
});

const jsonError = (response: Parameters<typeof aiRouter.post>[1]["arguments"][1], message: string, status: number) => {
  response.status(status).json({ error: message });
};

const base64ToUint8Array = (base64: string) => Uint8Array.from(Buffer.from(base64, "base64"));

const isOpenAIGptImageModel = (model: string) => model.startsWith("gpt-image-");
const isOpenAIGptImage2Model = (model: string) =>
  model === "gpt-image-2" || /^gpt-image-2\.5-(flare|sunburst)(?:-\d{4}-\d{2}-\d{2})?$/.test(model);
const getOpenAIImageQuality = (model: string) =>
  model.endsWith("-mini") || isOpenAIGptImage2Model(model) ? "medium" : "high";

const getLegacyApiModel = (modelId: string, configuredApiModel?: string | null) => {
  const legacyMap: Record<string, string> = {
    gemini: "gemini-3-pro-image",
    "gemini-25-image-economy": "gemini-2.5-flash-image",
    "gemini-25-flash-image": "gemini-3.1-flash-image",
    "gemini-3-pro-image": "gemini-3-pro-image",
    "dall-e-3": "dall-e-3",
    "openai-gpt-image-2": "gpt-image-2",
    "openai-gpt-image-2.5-flare": "gpt-image-2.5-flare",
    "openai-gpt-image-2.5-sunburst": "gpt-image-2.5-sunburst",
    "studio-ultra": "gpt-image-2",
    "studio-max": "gpt-image-1",
    "studio-swift": "gpt-image-1-mini",
  };

  const normalizedConfiguredApiModel = configuredApiModel?.trim().toLowerCase();
  if (normalizedConfiguredApiModel) {
    return legacyMap[normalizedConfiguredApiModel] || configuredApiModel!.trim();
  }

  return legacyMap[modelId] || modelId;
};

const getLegacyProvider = (
  modelId: string,
  configuredProvider?: string | null,
  configuredApiModel?: string | null
) => {
  const normalizedProvider = configuredProvider ? String(configuredProvider).trim().toLowerCase() : "";
  if (normalizedProvider && normalizedProvider !== "custom") {
    return normalizedProvider;
  }

  const normalizedApiModel = configuredApiModel ? String(configuredApiModel).trim().toLowerCase() : "";
  if (
    normalizedApiModel.startsWith("gpt-") ||
    normalizedApiModel.startsWith("o1") ||
    normalizedApiModel.startsWith("o3") ||
    normalizedApiModel.startsWith("dall-e")
  ) {
    return "openai";
  }

  if (normalizedApiModel.includes("gemini")) return "google";

  if (modelId === "gemini") return "google";
  if (modelId === "dall-e-3" || modelId.startsWith("studio-")) return "openai";
  if (modelId.startsWith("openai-")) return "openai";
  return "custom";
};

const getFileExtensionFromMimeType = (mimeType: string) => {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "png";
};

const getGeminiGenerationConfig = () => ({
  responseModalities: ["TEXT", "IMAGE"],
});

const getMimeTypeFromPath = (storagePath: string) => {
  const normalized = storagePath.toLowerCase();
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
};

const getOpenAIImageSize = (dimensions?: string, apiModel?: string) => {
  const usesGptImage = apiModel ? isOpenAIGptImageModel(apiModel) : false;

  if (!dimensions) return "1024x1024";

  if (apiModel && isOpenAIGptImage2Model(apiModel)) {
    if (dimensions.includes("1080x1350") || dimensions.includes("1024x1280")) return "1088x1360";
    if (dimensions.includes("1920x1080") || dimensions.includes("1792x1024") || dimensions.includes("1536x1024")) {
      return "1792x1008";
    }
    if (dimensions.includes("1080x1920") || dimensions.includes("1024x1792")) return "1008x1792";
    if (dimensions.includes("1024x1536")) return "1024x1536";
    return "1024x1024";
  }

  if (usesGptImage) {
    if (dimensions.includes("1024x1280") || dimensions.includes("1080x1350")) return "1024x1536";
    if (dimensions.includes("1536x1024") || dimensions.includes("1792x1024") || dimensions.includes("1920x1080")) return "1536x1024";
    if (dimensions.includes("1024x1536") || dimensions.includes("1024x1792") || dimensions.includes("1080x1920")) {
      return "1024x1536";
    }
    return "1024x1024";
  }

  if (dimensions.includes("1024x1280") || dimensions.includes("1080x1350")) return "1024x1792";
  if (dimensions.includes("1536x1024") || dimensions.includes("1792x1024") || dimensions.includes("1920x1080")) return "1792x1024";
  if (dimensions.includes("1024x1536") || dimensions.includes("1024x1792") || dimensions.includes("1080x1920")) {
    return "1024x1792";
  }
  return "1024x1024";
};

const getImageAspectRatio = (dimensions?: string) => {
  if (!dimensions) return "1:1";
  if (dimensions.includes("1080x1350") || dimensions.includes("1024x1280")) return "4:5";
  if (dimensions.includes("1536x1024")) return "3:2";
  if (dimensions.includes("1920x1080") || dimensions.includes("1792x1024")) {
    return "16:9";
  }
  if (dimensions.includes("1080x1920") || dimensions.includes("1024x1792")) return "9:16";
  if (dimensions.includes("1024x1536")) return "2:3";
  return "1:1";
};

const TEXT_RENDERING_RULES = [
  "TEXT ACCURACY IS A HARD REQUIREMENT.",
  "Treat every quoted string and every value inside a COPY ON IMAGE or LOCKED COPY block as immutable, locked copy.",
  "Render only the explicitly requested visible text and copy it character-for-character, word-for-word, in the same order.",
  "Preserve spelling, spaces, punctuation, capitalization and Polish diacritics exactly: \u0105, \u0107, \u0119, \u0142, \u0144, \u00f3, \u015b, \u017a, \u017c and \u0104, \u0106, \u0118, \u0141, \u0143, \u00d3, \u015a, \u0179, \u017b.",
  "Quotation marks used to delimit locked copy are instructions and must not be printed unless the requested text itself contains quotation marks.",
  "Never translate, paraphrase, spell-correct, autocomplete, hyphenate, truncate, duplicate, invent, or add filler text.",
  "Do not add random microcopy, fake labels, fake numbers, fake UI text, logos, signatures, or watermarks.",
  "Use clean readable typography with high contrast, generous spacing and straight, undistorted baselines.",
  "If copy does not fit, reduce the font size slightly or reflow it inside safe margins; never crop, omit, or alter any character.",
  "Before finalizing the image, compare every visible word against the locked copy character-by-character and correct all discrepancies.",
].join(" ");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runWithConcurrency = async <T>(
  count: number,
  concurrency: number,
  task: (index: number) => Promise<T>
): Promise<T[]> => {
  const results = new Array<T>(count);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), count);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < count) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await task(currentIndex);
      }
    })
  );

  return results;
};

const readProviderErrorBody = async (response: Response) => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

const handleGeminiImageError = async (
  response: Response,
  context: { apiModel: string; referenceCount: number; operation: string }
): Promise<never> => {
  const body = await readProviderErrorBody(response);
  console.error("Gemini image API error:", {
    status: response.status,
    apiModel: context.apiModel,
    referenceCount: context.referenceCount,
    operation: context.operation,
    body: body.slice(0, 1500),
  });

  if (response.status === 429) throw new Error("RATE_LIMIT");
  if (response.status === 402 || response.status === 403) throw new Error("AI_BILLING_ERROR");

  const normalizedBody = body.toLowerCase();
  if (
    (response.status === 400 || response.status === 413) &&
    (normalizedBody.includes("payload") ||
      normalizedBody.includes("request size") ||
      normalizedBody.includes("too large") ||
      normalizedBody.includes("size limit"))
  ) {
    throw new AiRouteError("Zdjecia referencyjne sa za duze. Zmniejsz pliki albo dodaj mniej referencji.", 413);
  }

  throw new Error("GENERATION_FAILED");
};

const handleOpenAIImageError = async (
  response: Response,
  context: { apiModel: string; referenceCount: number; operation: string }
): Promise<never> => {
  const body = await readProviderErrorBody(response);
  console.error("OpenAI image API error:", {
    status: response.status,
    apiModel: context.apiModel,
    referenceCount: context.referenceCount,
    operation: context.operation,
    body: body.slice(0, 1500),
  });

  if (response.status === 429) throw new Error("RATE_LIMIT");
  if (response.status === 402 || response.status === 403) throw new Error("AI_BILLING_ERROR");
  const normalizedBody = body.toLowerCase();
  if (
    normalizedBody.includes("billing_hard_limit_reached") ||
    normalizedBody.includes("billing hard limit") ||
    normalizedBody.includes("billing_limit_user_error")
  ) {
    throw new Error("AI_BILLING_HARD_LIMIT");
  }
  throw new Error("GENERATION_FAILED");
};

const getSafeErrorMessage = (error: unknown): { message: string; status: number } => {
  if (error instanceof AiRouteError) {
    return { message: error.message, status: error.status };
  }

  if (error instanceof GenerationConcurrencyError) {
    return { message: error.message, status: error.status };
  }

  if (error instanceof Error) {
    switch (error.message) {
      case "INVALID_IMAGE_BACKGROUND":
        return { message: "Niepoprawne ustawienie tła grafiki.", status: 400 };
      case "TRANSPARENT_BACKGROUND_UNSUPPORTED":
        return { message: "Ten model nie obsługuje natywnego PNG bez tła. Wybierz Sunburst, Flare lub Studio Ultra.", status: 400 };
      case "TRANSPARENT_BACKGROUND_MISSING":
        return { message: "Model zwrócił obraz bez przezroczystości zamiast PNG bez tła. Wynik nie został zapisany; pobrane kredyty zostały zwrócone.", status: 502 };

      case "RATE_LIMIT":
        return { message: "Zbyt wiele zapytan. Sprobuj za chwile.", status: 429 };
      case "AI_BILLING_ERROR":
        return { message: "Brak srodkow na koncie AI. Sprobuj ponownie pozniej.", status: 402 };
      case "AI_BILLING_HARD_LIMIT":
        return { message: "Limit rozliczen OpenAI zostal osiagniety. Wybierz Studio Flash/Ultra albo zwieksz limit w panelu OpenAI.", status: 402 };
      case "AI_SERVICE_UNAVAILABLE":
        return { message: "Usluga AI jest tymczasowo niedostepna.", status: 503 };
      case "GENERATION_FAILED":
        return { message: "Nie udalo sie wygenerowac obrazu. Sprobuj inny opis lub model.", status: 500 };
      case "PROMPT_GENERATION_FAILED":
        return { message: "Nie udalo sie wygenerowac promptu.", status: 500 };
      case "OCR_FAILED":
        return { message: "Nie udalo sie wyciagnac tekstu z obrazu.", status: 500 };
      case "REFERENCE_IMAGES_UNSUPPORTED":
        return { message: "Wybrany model nie obsluguje zdjec referencyjnych.", status: 400 };
      default:
        if (error.message.toLowerCase().includes("kredyt")) {
          return { message: error.message, status: 429 };
        }
    }
  }

  return { message: "Wystapil blad podczas generowania grafiki.", status: 500 };
};

const getModelApiKey = async (modelId: string, provider: string, apiModel?: string) => {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const normalizedApiModel = String(apiModel || "").trim().toLowerCase();
  const normalizedModelId = String(modelId || "").trim().toLowerCase();

  if (normalizedProvider === "openai") return env.openAiApiKey || null;
  if (normalizedProvider === "google" || normalizedProvider === "gemini") return env.geminiApiKey || null;

  if (
    normalizedApiModel.startsWith("gpt-") ||
    normalizedApiModel.startsWith("o1") ||
    normalizedApiModel.startsWith("o3") ||
    normalizedApiModel.startsWith("dall-e")
  ) {
    return env.openAiApiKey || null;
  }

  if (normalizedApiModel.includes("gemini")) {
    return env.geminiApiKey || null;
  }

  if (
    normalizedModelId.startsWith("gpt-") ||
    normalizedModelId.startsWith("o1") ||
    normalizedModelId.startsWith("o3") ||
    normalizedModelId.startsWith("dall-e")
  ) {
    return env.openAiApiKey || null;
  }

  if (normalizedModelId.includes("gemini")) {
    return env.geminiApiKey || null;
  }

  return null;
};

const getActiveModelConfig = async (selectedModelId: string, purpose: "generation" | "editing") => {
  const models = await listLocalAiModels();
  const matched = models.find(
    (row) =>
      row.active &&
      row.model_id === selectedModelId &&
      (purpose === "generation" ? row.supports_generation : row.supports_editing)
  );

  if (!matched) {
    throw new AiRouteError("Wybrany model nie jest dostepny", 400);
  }

  return matched;
};

const getToolCost = async (toolId: string | undefined, fallbackCost: number) => {
  if (!toolId) return fallbackCost;

  const rows = await listLocalToolPricing();
  const matched = rows.find((row) => row.tool_id === toolId && row.active);
  return matched?.credit_cost ?? fallbackCost;
};

const deductCreditsLocally = async (userId: string, cost: number, isAdmin: boolean) => {
  if (isAdmin || cost <= 0) {
    return false;
  }

  const updatedCredit = await deductLocalUserCreditsBalance(userId, cost);
  if (!updatedCredit) {
    throw new AiRouteError("Niewystarczajaca ilosc kredytow. Kup wiecej w zakladce Kredyty.", 429);
  }
  return true;
};

const getGenerationJobTier = async (userId: string, isAdmin: boolean): Promise<GenerationJobTier> => {
  if (isAdmin) return "admin";

  const completedPurchases = await listLocalCreditPurchases({ userId, status: "completed", limit: 1 });
  return completedPurchases.length > 0 ? "paid" : "free";
};

const refundCreditsLocally = async (userId: string, cost: number, shouldRefund: boolean) => {
  if (!shouldRefund || cost <= 0) return;

  await addLocalUserCreditsBalance(userId, cost).catch((error) => {
    console.error("VPS AI credit refund failed:", {
      userId,
      cost,
      error: error instanceof Error ? error.message : String(error),
    });
  });
};

const ensureCreditsAvailableLocally = async (userId: string, cost: number, isAdmin: boolean) => {
  if (isAdmin || cost <= 0) {
    return;
  }

  const userCredit = await getLocalUserCredit(userId);
  const currentBalance = Number(userCredit?.balance ?? 0);
  if (currentBalance < cost) {
    throw new AiRouteError("Niewystarczajaca ilosc kredytow. Kup wiecej w zakladce Kredyty.", 429);
  }
};

const ensureDailyCreditSpendLimit = async (userId: string, cost: number, isAdmin: boolean) => {
  const dailyLimit = Math.max(Math.floor(Number(env.dailyCreditSpendLimit) || 0), 0);
  if (isAdmin || cost <= 0 || dailyLimit <= 0) {
    return;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const usedInLast24h = await getLocalCreditUsageTotalSince(userId, since);
  if (usedInLast24h + cost > dailyLimit) {
    throw new AiRouteError(
      `Limit bezpieczenstwa: mozesz uzyc maksymalnie ${dailyLimit} kredytow w 24h. Sprobuj pozniej albo skontaktuj sie z administratorem.`,
      429
    );
  }
};

const validateBase64ImageInput = (imageBase64: string) => {
  if (imageBase64.length > MAX_INPUT_IMAGE_BASE64_LENGTH) {
    throw new AiRouteError("Obraz jest zbyt duzy. Wgraj mniejszy plik.", 413);
  }
};

const normalizeDataUrl = (imageBase64: string, imageMimeType?: string | null) => {
  if (imageBase64.startsWith("data:")) return imageBase64;
  return `data:${imageMimeType || "image/png"};base64,${imageBase64}`;
};

const extractOpenAiText = (content: unknown) => {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
};

const extractGeminiText = (data: unknown) => {
  const parts = (data as any)?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
};

type VisionTextTaskParams = {
  imageBase64: string;
  imageMimeType?: string;
  systemInstruction: string;
  userInstruction: string;
  maxTokens?: number;
  emptyResultErrorCode: "PROMPT_GENERATION_FAILED" | "OCR_FAILED";
  providerPreference?: Array<"google" | "openai">;
};

const runVisionTaskWithGemini = async (params: VisionTextTaskParams) => {
  if (!env.geminiApiKey) {
    throw new Error("AI_SERVICE_UNAVAILABLE");
  }

  const modelCandidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  const inlineMimeType = params.imageMimeType || "image/png";

  for (const model of modelCandidates) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: inlineMimeType, data: params.imageBase64 } },
                { text: `${params.systemInstruction}\n\n${params.userInstruction}` },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: params.maxTokens ?? 450,
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        continue;
      }
      if (response.status === 429) {
        throw new Error("RATE_LIMIT");
      }
      if (response.status === 402 || response.status === 403) {
        throw new Error("AI_BILLING_ERROR");
      }
      throw new Error("AI_SERVICE_UNAVAILABLE");
    }

    const data = await response.json();
    const text = extractGeminiText(data);
    if (text) {
      return text;
    }
  }

  throw new Error(params.emptyResultErrorCode);
};

const runVisionTaskWithOpenAi = async (params: VisionTextTaskParams) => {
  if (!env.openAiApiKey) {
    throw new Error("AI_SERVICE_UNAVAILABLE");
  }

  const modelCandidates = ["gpt-4o", "gpt-4.1-mini"];
  const dataUrl = normalizeDataUrl(params.imageBase64, params.imageMimeType);

  for (const model of modelCandidates) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: params.systemInstruction,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
              {
                type: "text",
                text: params.userInstruction,
              },
            ],
          },
        ],
        max_tokens: params.maxTokens ?? 450,
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        continue;
      }
      if (response.status === 429) {
        throw new Error("RATE_LIMIT");
      }
      if (response.status === 402) {
        throw new Error("AI_BILLING_ERROR");
      }
      throw new Error("AI_SERVICE_UNAVAILABLE");
    }

    const data = await response.json();
    const text = extractOpenAiText(data?.choices?.[0]?.message?.content);
    if (text) {
      return text;
    }
  }

  throw new Error(params.emptyResultErrorCode);
};

const runVisionTextTask = async (params: VisionTextTaskParams) => {
  const availableProviders: Array<"google" | "openai"> = [];
  if (env.geminiApiKey) availableProviders.push("google");
  if (env.openAiApiKey) availableProviders.push("openai");
  const preferredProviders = params.providerPreference || [];
  const providers = [
    ...preferredProviders.filter((provider) => availableProviders.includes(provider)),
    ...availableProviders.filter((provider) => !preferredProviders.includes(provider)),
  ];

  if (providers.length === 0) {
    throw new Error("AI_SERVICE_UNAVAILABLE");
  }

  let lastError: unknown = null;

  for (const provider of providers) {
    try {
      if (provider === "google") {
        return await runVisionTaskWithGemini(params);
      }
      return await runVisionTaskWithOpenAi(params);
    } catch (error) {
      lastError = error;

      if (error instanceof Error && (error.message === "RATE_LIMIT" || error.message === "AI_BILLING_ERROR")) {
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("AI_SERVICE_UNAVAILABLE");
};

const countPromptSections = (prompt: string) => {
  const matches = prompt.match(/^[A-Z][A-Z0-9 /&().-]{2,}:$/gm);
  return matches?.length ?? 0;
};

const isWeakGeneratedPrompt = (prompt: string) => {
  const normalized = prompt.trim();
  if (normalized.length < 900) return true;
  if (countPromptSections(normalized) < 7) return true;

  const lower = normalized.toLowerCase();
  const hasRenderDetails =
    lower.includes("mockup") ||
    lower.includes("render") ||
    lower.includes("perspective") ||
    lower.includes("lighting") ||
    lower.includes("shadows");
  const hasDesignDetails =
    lower.includes("typography") ||
    lower.includes("layout") ||
    lower.includes("composition") ||
    lower.includes("colors") ||
    lower.includes("style");

  return !hasRenderDetails || !hasDesignDetails;
};

const generatePromptFromImage = async (params: {
  imageBase64: string;
  imageMimeType?: string;
  promptType?: string;
  outputLanguage?: string;
}) => {
  const promptMode = PROMPT_TYPE_INSTRUCTIONS[params.promptType || "universal"] || PROMPT_TYPE_INSTRUCTIONS.universal;
  const languageMode = LANGUAGE_INSTRUCTIONS[params.outputLanguage || "pl"] || LANGUAGE_INSTRUCTIONS.pl;
  const baseSystemInstruction = [
    "You are an elite image prompt engineer for realistic product renders, commercial ads, ecommerce mockups, social media creatives, branding, and visual recreation.",
    "Your outputs are used directly in AI image generators, so they must be concrete, production-ready, and richly specified.",
    promptMode,
    languageMode,
    IMAGE_TO_PROMPT_STRUCTURE_INSTRUCTION,
    IMAGE_TO_PROMPT_OUTPUT_TEMPLATE,
  ].join(" ");
  const baseUserInstruction = [
    "Analyze this image as a reference asset and convert it into one strong prompt that can generate a similar high-quality image.",
    "Capture exact visible text, hierarchy, product type, layout, style, colors, typography, lighting, perspective, background, and final use case.",
    "If it looks like an ebook/course/finance/product mockup, make the result similar in depth and structure to a premium ebook box mockup prompt with title, subtitle, bottom text, style, colors, cover design, mockup, spine text, and format.",
    "Do not stop after PRODUCT. Write the full prompt with all relevant sections.",
  ].join(" ");

  let prompt = await runVisionTextTask({
    imageBase64: params.imageBase64,
    imageMimeType: params.imageMimeType,
    systemInstruction: baseSystemInstruction,
    userInstruction: baseUserInstruction,
    maxTokens: 1700,
    emptyResultErrorCode: "PROMPT_GENERATION_FAILED",
    providerPreference: ["openai", "google"],
  });

  if (!prompt) {
    throw new Error("PROMPT_GENERATION_FAILED");
  }

  if (isWeakGeneratedPrompt(prompt)) {
    prompt = await runVisionTextTask({
      imageBase64: params.imageBase64,
      imageMimeType: params.imageMimeType,
      systemInstruction: [
        baseSystemInstruction,
        "The previous answer was too short. This time you MUST write a complete structured generation prompt of at least 1200 characters.",
        "You MUST include meaningful sections for PRODUCT, MAIN TEXT / TITLE, SUBTITLE / SUPPORTING TEXT, BADGES / BOTTOM SECTION / CTA, STYLE, COLORS, TYPOGRAPHY, DESIGN / COVER LAYOUT, MOCKUP / RENDER, BACKGROUND, FORMAT, and NEGATIVE PROMPT when relevant.",
        "Never stop after one or two sections.",
      ].join(" "),
      userInstruction: [
        baseUserInstruction,
        "Regenerate the final prompt now. Make it detailed enough to recreate the reference as a premium marketing/product asset. Include exact visible text where readable.",
      ].join(" "),
      maxTokens: 2200,
      emptyResultErrorCode: "PROMPT_GENERATION_FAILED",
      providerPreference: ["openai", "google"],
    });
  }

  return prompt;
};

const extractTextFromImage = async (params: { imageBase64: string; imageMimeType?: string }) => {
  const text = await runVisionTextTask({
    imageBase64: params.imageBase64,
    imageMimeType: params.imageMimeType,
    systemInstruction:
      'Jestes narzedziem OCR. Wyciagnij CALY tekst widoczny na obrazie. Zwroc go dokladnie tak, jak jest napisany, zachowujac formatowanie (nowe linie, odstepy). Jesli tekst jest w tabelce - oddaj to jako tabelke. Nie dodawaj swoich komentarzy, tylko surowy tekst z obrazu. Jesli nie ma tekstu, napisz: "(brak tekstu na obrazie)".',
    userInstruction: "Wyciagnij caly tekst z tego obrazu.",
    maxTokens: 1200,
    emptyResultErrorCode: "OCR_FAILED",
  });
  return text || "(brak tekstu)";
};

const recordCreditUsage = async (userId: string, creditsUsed: number, model: string) => {
  if (creditsUsed <= 0) return;
  if (!hasLocalDatabase()) return;

  const row = {
    id: randomUUID(),
    user_id: userId,
    credits_used: creditsUsed,
    model,
    created_at: new Date().toISOString(),
  };

  await upsertLocalCreditUsageRows([row]);
};

const downloadReferenceImage = async (storagePath: string): Promise<ReferenceImage | null> => {
  try {
    const relativePath = storagePathToRelativePath(storagePath);
    const buffer = await readStorageFile(storagePath);
    return {
      base64: buffer.toString("base64"),
      mimeType: getMimeTypeFromPath(relativePath),
    };
  } catch {
    return null;
  }
};

const saveGeneratedGraphicToStorage = async (params: {
  userId: string;
  base64: string;
  mimeType: string;
  prompt: string;
  style: string;
  type: string;
  dimensions?: string | null;
  parentGraphicId?: string | null;
}) => {
  const sourceBuffer = Buffer.from(params.base64, "base64");
  const dimensionMatch = params.dimensions?.match(/^(\d+)x(\d+)$/);
  const shouldNormalizeDimensions =
    Boolean(dimensionMatch) &&
    ALLOWED_IMAGE_DIMENSIONS.includes(params.dimensions as (typeof ALLOWED_IMAGE_DIMENSIONS)[number]);
  const buffer = shouldNormalizeDimensions
    ? await sharp(sourceBuffer)
        .rotate()
        .resize(Number(dimensionMatch![1]), Number(dimensionMatch![2]), {
          fit: "fill",
        })
        .png()
        .toBuffer()
    : sourceBuffer;
  const outputMimeType = shouldNormalizeDimensions ? "image/png" : params.mimeType;
  const extension = getFileExtensionFromMimeType(outputMimeType);
  const relativePath = `graphics/${params.userId}/${randomUUID()}.${extension}`;
  const storagePath = await writeStorageFile(relativePath, buffer, { contentType: outputMimeType });
  const graphic = await createLocalGraphic({
    user_id: params.userId,
    url: storagePath,
    prompt: params.prompt,
    style: params.style,
    type: params.type,
    dimensions: params.dimensions ?? null,
    parent_id: params.parentGraphicId ?? null,
  });

  await recordLocalGraphicHistoryEntry({
    graphic_id: graphic.id,
    user_id: params.userId,
    prompt: params.prompt,
    style: params.style,
    type: params.type,
    dimensions: params.dimensions ?? null,
    created_at: graphic.created_at,
  });

  const staleGraphics = await trimLocalSavedGraphics(params.userId, MAX_SAVED_GRAPHICS);
  await Promise.all(staleGraphics.map((row) => deleteGraphicFile(row.url).catch(() => null)));

  return {
    graphic,
    imageUrl: (await getStorageDisplayUrl(storagePath)) || "",
    storagePath,
    trimmedCount: staleGraphics.length,
  };
};

type SavedGeneratedGraphic = Awaited<ReturnType<typeof saveGeneratedGraphicToStorage>>;

const cleanupSavedGraphics = async (savedGraphics: SavedGeneratedGraphic[]) => {
  if (!savedGraphics.length) return;

  await Promise.allSettled(savedGraphics.map((item) => deleteGraphicFile(item.storagePath)));
  await deleteLocalGraphicsByIds(savedGraphics.map((item) => item.graphic.id)).catch(() => null);
};

const buildGenerationPrompt = (prompt: string, style: string | undefined, dimensions: string | undefined) => {
  const styleDesc = STYLE_MAP[style || "realistic"] || STYLE_MAP.realistic;
  const aspectRatio = getImageAspectRatio(dimensions);
  if (isCompiledAdPrompt(prompt)) {
    return `Use the selected ${aspectRatio} canvas with target export dimensions ${dimensions || "1024x1024"}. Adapt the layout to this format, retaining the full text and safe insets. Follow the advertisement's own art direction, not a generic photographic style. The following instructions are not lettering.\n\n${AD_IMAGE_QUALITY_LOCK}\n\n${prompt}`;
  }
  return `Generate an image: ${prompt}. ${TEXT_RENDERING_RULES} Style: ${styleDesc}. OUTPUT FORMAT OVERRIDE — this instruction is mandatory and takes priority over every format, aspect ratio, resolution, canvas size, orientation, or crop instruction inside the user prompt: generate only on a ${aspectRatio} canvas with target export dimensions ${dimensions || "1024x1024"}. Compose the entire design for this selected format from the start. Keep every title, chart, label, border, and important visual fully inside the canvas with safe margins. Do not crop, cut off, squeeze, or place important content outside the frame. High quality, detailed.`;
};

const generateWithGemini = async (
  fullPrompt: string,
  dimensions: string | undefined,
  referenceImages: ReferenceImage[],
  apiModel: string,
  apiKey: string | null
): Promise<GeneratedImageResult> => {
  if (!apiKey) throw new Error("AI_SERVICE_UNAVAILABLE");

  const parts: Array<Record<string, unknown>> =
    referenceImages.length > 0
      ? [
          {
            text: isCompiledAdPrompt(fullPrompt)
              ? `${AD_REFERENCE_INSTRUCTIONS} ${fullPrompt}`
              : `Use these ${referenceImages.length} reference image(s) as the primary visual source. Preserve their palette, composition, line style, proportions, and design language as closely as possible. If the user asks for a small change, keep everything else unchanged. ${fullPrompt}`,
          },
          ...referenceImages.map((ref) => ({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } })),
        ]
      : [{ text: fullPrompt }];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: getGeminiGenerationConfig(),
      }),
    }
  );

  if (!response.ok) {
    await handleGeminiImageError(response, {
      apiModel,
      referenceCount: referenceImages.length,
      operation: "generate",
    });
  }

  const data = await response.json();
  const candidateParts = data.candidates?.[0]?.content?.parts;
  if (!candidateParts) throw new Error("GENERATION_FAILED");

  for (const part of candidateParts) {
    if (part.inlineData?.data) {
      return {
        base64: String(part.inlineData.data),
        mimeType: String(part.inlineData.mimeType || "image/png"),
      };
    }
  }

  throw new Error("GENERATION_FAILED");
};

export const generateWithOpenAI = async (
  fullPrompt: string,
  dimensions: string | undefined,
  apiModel: string,
  referenceImages: ReferenceImage[],
  apiKey: string | null,
  background: ImageBackground = "auto"
): Promise<GeneratedImageResult> => {
  if (!apiKey) throw new Error("AI_SERVICE_UNAVAILABLE");

  fullPrompt = imageBackgroundPrompt(fullPrompt, background);
  const size = getOpenAIImageSize(dimensions, apiModel);

  if (referenceImages.length > 0) {
    if (!isOpenAIGptImageModel(apiModel)) {
      throw new Error("REFERENCE_IMAGES_UNSUPPORTED");
    }

    const formData = new FormData();
    formData.append("model", apiModel);
    formData.append(
      "prompt",
      isCompiledAdPrompt(fullPrompt)
        ? `${AD_REFERENCE_INSTRUCTIONS} ${fullPrompt}`
        : `Use the provided image references as the primary visual source. Preserve their identity, palette, composition, and style whenever possible. ${fullPrompt}`
    );
    formData.append("size", size);
    if (!isOpenAIGptImage2Model(apiModel)) {
      formData.append("input_fidelity", "high");
    }
    formData.append("output_format", "png");
    if (background !== "auto") formData.append("background", background);
    formData.append("quality", getOpenAIImageQuality(apiModel));

    referenceImages.forEach((image, index) => {
      formData.append(
        "image[]",
        new Blob([base64ToUint8Array(image.base64)], { type: image.mimeType }),
        `reference-${index + 1}.${getFileExtensionFromMimeType(image.mimeType)}`
      );
    });

    const editResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!editResponse.ok) {
      await handleOpenAIImageError(editResponse, {
        apiModel,
        referenceCount: referenceImages.length,
        operation: "generate-with-references",
      });
    }

    const editData = await editResponse.json();
    const editBase64 = editData.data?.[0]?.b64_json;
    if (!editBase64) throw new Error("GENERATION_FAILED");

    await assertImageBackground(editBase64, background);
    return { base64: editBase64, mimeType: "image/png" };
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(
      isOpenAIGptImageModel(apiModel)
        ? {
            model: apiModel,
            prompt: fullPrompt,
            size,
            output_format: "png",
            ...(background !== "auto" ? { background } : {}),
            quality: getOpenAIImageQuality(apiModel),
          }
        : {
            model: apiModel,
            prompt: fullPrompt,
            n: 1,
            size,
            response_format: "b64_json",
            quality: "hd",
          }
    ),
  });

  if (!response.ok) {
    await handleOpenAIImageError(response, {
      apiModel,
      referenceCount: 0,
      operation: "generate",
    });
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("GENERATION_FAILED");

  await assertImageBackground(b64, background);
  return { base64: b64, mimeType: "image/png" };
};

const editWithOpenAI = async (params: {
  prompt: string;
  imageBase64: string;
  imageMimeType: string;
  maskBase64?: string;
  dimensions?: string;
  apiModel: string;
  apiKey: string | null;
}): Promise<GeneratedImageResult> => {
  if (!params.apiKey) throw new Error("AI_SERVICE_UNAVAILABLE");

  if (isOpenAIGptImageModel(params.apiModel) && !params.maskBase64) {
    const strictPrompt = [
      "Apply only the explicitly requested edit.",
      "Keep the original composition, framing, colors, layout, proportions, style, background, and every unchanged element exactly the same as in the source image.",
      TEXT_RENDERING_RULES,
      params.prompt,
      `OUTPUT FORMAT OVERRIDE: ignore every format, aspect ratio, resolution, orientation, or crop instruction in the edit prompt. Use only the selected ${getImageAspectRatio(params.dimensions)} format (${params.dimensions || "1024x1024"}) and keep all important content inside the canvas.`,
    ].join(" ");

    const formData = new FormData();
    formData.append("model", params.apiModel);
    formData.append("prompt", strictPrompt);
    formData.append("size", getOpenAIImageSize(params.dimensions, params.apiModel));
    if (!isOpenAIGptImage2Model(params.apiModel)) {
      formData.append("input_fidelity", "high");
    }
    formData.append("output_format", "png");
    formData.append("quality", getOpenAIImageQuality(params.apiModel));
    formData.append(
      "image[]",
      new Blob([base64ToUint8Array(params.imageBase64)], { type: params.imageMimeType }),
      `source.${getFileExtensionFromMimeType(params.imageMimeType)}`
    );

    const editResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${params.apiKey}` },
      body: formData,
    });

    if (!editResponse.ok) {
      await handleOpenAIImageError(editResponse, {
        apiModel: params.apiModel,
        referenceCount: 1,
        operation: "edit",
      });
    }

    const editData = await editResponse.json();
    const resultBase64 = editData.data?.[0]?.b64_json;
    if (!resultBase64) throw new Error("GENERATION_FAILED");

    return { base64: resultBase64, mimeType: "image/png" };
  }

  const editPrompt = params.maskBase64
    ? `Based on the provided image, modify ONLY the areas marked in red in the mask image according to this instruction: "${params.prompt}". Generate a complete new image that looks like the original but with the requested changes applied to the masked areas.`
    : `Based on the provided image, apply only the explicitly requested edit: "${params.prompt}". Preserve the original composition, framing, colors, layout, proportions, style, background, and every unchanged element exactly as in the source image. Generate the complete edited image.`;

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: editPrompt },
        { type: "image_url", image_url: { url: `data:${params.imageMimeType};base64,${params.imageBase64}` } },
        ...(params.maskBase64
          ? [{ type: "image_url", image_url: { url: `data:image/png;base64,${params.maskBase64}` } }]
          : []),
      ],
    },
  ];

  const maxRetries = 3;
  let description = "";

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are an image editing assistant. Describe in detail what the final edited image should look like, incorporating the user's edit request. Be very specific about colors, composition, objects, and style. Output ONLY the image description, nothing else.",
          },
          ...messages,
        ],
        max_tokens: 500,
      }),
    });

    if (visionResponse.ok) {
      const visionData = await visionResponse.json();
      description = String(visionData.choices?.[0]?.message?.content || "");
      break;
    }

    if (visionResponse.status === 429 && attempt < maxRetries - 1) {
      await sleep((attempt + 1) * 10000);
      continue;
    }

    if (visionResponse.status === 429) throw new Error("RATE_LIMIT");
    throw new Error("GENERATION_FAILED");
  }

  if (!description) {
    throw new Error("GENERATION_FAILED");
  }

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(
        isOpenAIGptImageModel(params.apiModel)
          ? {
              model: params.apiModel,
              prompt: `${TEXT_RENDERING_RULES} ${description}`,
              size: "auto",
              output_format: "png",
              quality: getOpenAIImageQuality(params.apiModel),
            }
          : {
              model: params.apiModel,
              prompt: `${TEXT_RENDERING_RULES} ${description}`,
              n: 1,
              size: "1024x1024",
              response_format: "b64_json",
              quality: "hd",
            }
      ),
    });

    if (response.ok) {
      const data = await response.json();
      const resultBase64 = data.data?.[0]?.b64_json;
      if (!resultBase64) throw new Error("GENERATION_FAILED");

      return { base64: resultBase64, mimeType: "image/png" };
    }

    if (response.status === 429 && attempt < maxRetries - 1) {
      await sleep((attempt + 1) * 10000);
      continue;
    }

    await handleOpenAIImageError(response, {
      apiModel: params.apiModel,
      referenceCount: params.maskBase64 ? 2 : 1,
      operation: params.maskBase64 ? "edit-mask-generate" : "edit-fallback-generate",
    });
  }

  throw new Error("GENERATION_FAILED");
};

const editWithGemini = async (params: {
  prompt: string;
  imageBase64: string;
  imageMimeType: string;
  maskBase64?: string;
  dimensions?: string;
  apiModel: string;
  apiKey: string | null;
}): Promise<GeneratedImageResult> => {
  if (!params.apiKey) throw new Error("AI_SERVICE_UNAVAILABLE");

  const parts: Array<Record<string, unknown>> = [
    { inlineData: { mimeType: params.imageMimeType, data: params.imageBase64 } },
  ];

  if (params.maskBase64) {
    parts.push({ inlineData: { mimeType: "image/png", data: params.maskBase64 } });
    parts.push({
      text: `I'm providing two images: the first is the original image, and the second is a mask where RED areas indicate the regions I want to modify. Please edit ONLY the red-masked areas of the original image according to this instruction: "${params.prompt}". Keep everything outside the red mask exactly the same. Return the complete edited image.`,
    });
  } else {
    parts.push({
      text: `Edit this image according to the following instruction: "${params.prompt}". Apply only the explicitly requested change. OUTPUT FORMAT OVERRIDE: ignore every format, aspect ratio, resolution, orientation, or crop instruction inside the edit prompt. Use only the selected ${getImageAspectRatio(params.dimensions)} format (${params.dimensions || "1024x1024"}). Recompose the complete image natively for that selected format when needed, keeping every important element fully visible with safe margins. Do not crop or cut off any content. Keep the colors, line thickness, style, background, and every unchanged element exactly the same. Return the complete edited image.`,
    });
  }

  const body = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: getGeminiGenerationConfig(),
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${params.apiModel}:generateContent?key=${params.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }
  );

  if (!response.ok) {
    await handleGeminiImageError(response, {
      apiModel: params.apiModel,
      referenceCount: params.maskBase64 ? 2 : 1,
      operation: "edit",
    });
  }

  const data = await response.json();
  const candidateParts = data.candidates?.[0]?.content?.parts;
  if (!candidateParts) throw new Error("GENERATION_FAILED");

  for (const part of candidateParts) {
    if (part.inlineData?.data) {
      return {
        base64: String(part.inlineData.data),
        mimeType: String(part.inlineData.mimeType || "image/png"),
      };
    }
  }

  throw new Error("GENERATION_FAILED");
};

const generateImageHandler: RequestHandler = async (request, response) => {
  const startedAt = Date.now();
  let reservedCredits: { userId: string; cost: number; active: boolean } | null = null;
  let activeGenerationJobId: string | null = null;

  try {
    const user = request.authUser!;
    const body = (request.body || {}) as GenerateImageBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const style = typeof body.style === "string" ? body.style : "realistic";
    const dimensions = typeof body.dimensions === "string" ? body.dimensions : undefined;
    const refPaths = Array.isArray(body.referenceImagePaths) ? body.referenceImagePaths.filter((value): value is string => typeof value === "string") : [];
    const requestedCount = Number.isInteger(body.count) ? Number(body.count) : 1;
    const selectedModelId = body.model || "gemini-25-flash-image";
    const companyContext =
      body.companyAssistantContext && typeof body.companyAssistantContext === "object"
        ? {
            packageId:
              typeof body.companyAssistantContext.packageId === "string"
                ? body.companyAssistantContext.packageId.slice(0, 120)
                : null,
            sessionId:
              typeof body.companyAssistantContext.sessionId === "string"
                ? body.companyAssistantContext.sessionId.slice(0, 120)
                : null,
            materialId:
              typeof body.companyAssistantContext.materialId === "string"
                ? body.companyAssistantContext.materialId.slice(0, 100)
                : "",
            materialTitle:
              typeof body.companyAssistantContext.materialTitle === "string"
                ? body.companyAssistantContext.materialTitle.slice(0, 200)
                : "",
          }
        : null;

    if (!prompt) {
      jsonError(response, "Prompt is required", 400);
      return;
    }

    if (!STYLE_MAP[style]) {
      jsonError(response, "Invalid style", 400);
      return;
    }

    if (dimensions && !ALLOWED_IMAGE_DIMENSIONS.includes(dimensions as (typeof ALLOWED_IMAGE_DIMENSIONS)[number])) {
      jsonError(response, "Invalid dimensions", 400);
      return;
    }

    if (requestedCount < 1 || requestedCount > 4) {
      jsonError(response, "Count must be between 1 and 4", 400);
      return;
    }

    const isAdmin = await hasLocalUserRole(user.id, "admin");
    const modelConfig = await getActiveModelConfig(selectedModelId, "generation");
    const modelProvider = getLegacyProvider(selectedModelId, modelConfig.provider, modelConfig.api_model);
    const apiModel = getLegacyApiModel(selectedModelId, modelConfig.api_model);
    const background = resolveImageBackground(body.background, prompt, modelProvider, apiModel);
    const supportsReferenceImages = Boolean(modelConfig.supports_reference_images ?? (modelProvider !== "openai"));
    const maxRefImages = isAdmin ? 10 : 5;

    if (refPaths.length > maxRefImages) {
      jsonError(response, `Maksymalnie ${maxRefImages} zdjec referencyjnych`, 400);
      return;
    }

    for (const path of refPaths) {
      const relativePath = storagePathToRelativePath(path);
      const isLegacyUserPath = relativePath.startsWith(`${user.id}/`);
      const isLocalUserPath = relativePath.startsWith(`graphics/${user.id}/`);

      if (!isLegacyUserPath && !isLocalUserPath) {
        jsonError(response, "Invalid reference image path", 400);
        return;
      }
    }

    if (refPaths.length > 0 && !supportsReferenceImages) {
      jsonError(response, "Wybrany model nie obsluguje zdjec referencyjnych.", 400);
      return;
    }

    // Model-driven generation is always billed from the server-side model catalog.
    // Never accept a client-provided tool id as a pricing override.
    const cost = modelConfig.credit_cost || 50;
    if (body.expectedCreditCost !== undefined && body.expectedCreditCost !== cost) {
      throw new AiRouteError("Cena modelu się zmieniła. Odśwież dostęp i sprawdź koszt.", 409);
    }
    const totalCost = cost * requestedCount;
    activeGenerationJobId = await reserveGenerationJob({
      userId: user.id,
      tier: await getGenerationJobTier(user.id, isAdmin),
      jobType: "generate-image",
      cost: totalCost,
      model: selectedModelId,
    });
    await ensureDailyCreditSpendLimit(user.id, totalCost, isAdmin);
    await ensureCreditsAvailableLocally(user.id, totalCost, isAdmin);

    const referenceImages: ReferenceImage[] = [];
    for (const refPath of refPaths) {
      const refData = await downloadReferenceImage(refPath);
      if (!refData) {
        jsonError(response, "Nie udalo sie odczytac jednego ze zdjec referencyjnych. Dodaj je ponownie.", 400);
        return;
      }
      referenceImages.push(refData);
    }

    const totalReferencePayloadSize = referenceImages.reduce((sum, item) => sum + item.base64.length, 0);
    if (totalReferencePayloadSize > MAX_REFERENCE_IMAGES_TOTAL_BASE64_LENGTH) {
      jsonError(response, "Zdjecia referencyjne sa za duze. Zmniejsz pliki albo dodaj mniej referencji.", 413);
      return;
    }

    const apiKey = await getModelApiKey(selectedModelId, modelProvider, apiModel);
    const fullPrompt = buildGenerationPrompt(prompt, style, dimensions);
    const creditsReserved = await deductCreditsLocally(user.id, totalCost, isAdmin);
    reservedCredits = { userId: user.id, cost: totalCost, active: creditsReserved };
    const generationConcurrency = requestedCount > 1 ? 2 : 1;
    const generatedResults = await runWithConcurrency(requestedCount, generationConcurrency, async () =>
        modelProvider === "openai"
          ? await generateWithOpenAI(fullPrompt, dimensions, apiModel, referenceImages, apiKey, background)
          : await generateWithGemini(fullPrompt, dimensions, referenceImages, apiModel, apiKey)
    );

    const savedGraphics: SavedGeneratedGraphic[] = [];

    for (const result of generatedResults) {
      const saved = await saveGeneratedGraphicToStorage({
        userId: user.id,
        base64: result.base64,
        mimeType: result.mimeType,
        prompt,
        style,
        type: "generated",
        dimensions: dimensions || null,
      });

      savedGraphics.push(saved);
    }

    if (companyContext?.sessionId || companyContext?.packageId) {
      await Promise.allSettled(
        savedGraphics.map((saved) =>
          createLocalCompanyAssistantAsset({
            userId: user.id,
            packageId: companyContext.packageId || null,
            sessionId: companyContext.sessionId || null,
            graphicId: saved.graphic.id,
            url: saved.storagePath,
            materialId: companyContext.materialId,
            materialTitle: companyContext.materialTitle,
            assetType:
              companyContext.materialId === "logo-concept"
                ? "logo"
                : companyContext.materialId === "brandbook"
                  ? "brandbook"
                  : "generated",
            prompt,
            dimensions: dimensions || null,
          }),
        ),
      );
    }

    await recordCreditUsage(user.id, totalCost, selectedModelId).catch((error) => {
      console.error("VPS AI credit usage record error:", error);
    });
    if (reservedCredits) reservedCredits.active = false;
    await finishGenerationJob(activeGenerationJobId, "completed");
    activeGenerationJobId = null;

    const imageUrls = savedGraphics.map((item) => item.imageUrl);
    const storagePaths = savedGraphics.map((item) => item.storagePath);
    const trimmedCount = savedGraphics.reduce((sum, item) => sum + item.trimmedCount, 0);

    console.info("VPS AI generation completed:", {
      model: selectedModelId,
      apiModel,
      provider: modelProvider,
      count: requestedCount,
      referenceCount: referenceImages.length,
      durationMs: Date.now() - startedAt,
    });

    response.json({
      imageUrl: imageUrls[0] || null,
      imageUrls,
      storagePath: storagePaths[0] || null,
      storagePaths,
      trimmedCount,
    });
  } catch (error) {
    if (reservedCredits?.active) {
      await refundCreditsLocally(reservedCredits.userId, reservedCredits.cost, true);
      reservedCredits.active = false;
    }
    await finishGenerationJob(activeGenerationJobId, "failed").catch((jobError) => {
      console.error("VPS AI generation job finish failed:", jobError);
    });
    activeGenerationJobId = null;
    console.error("VPS AI generation error:", error);
    const { message, status } = getSafeErrorMessage(error);
    jsonError(response, message, status);
  }
};

aiRouter.post("/ai/generate-image", requireAuthenticatedUser, aiGenerateRateLimit, generateImageHandler);
aiRouter.use(createCarouselImageRouter([aiGenerateRateLimit, generateImageHandler]));

aiRouter.post("/ai/edit-image", requireAuthenticatedUser, aiEditRateLimit, async (request, response) => {
  let reservedCredits: { userId: string; cost: number; active: boolean } | null = null;
  let activeGenerationJobId: string | null = null;

  try {
    const user = request.authUser!;
    const body = (request.body || {}) as EditImageBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    const imageMimeType =
      (typeof body.imageMimeType === "string" && body.imageMimeType) ||
      (typeof body.mimeType === "string" && body.mimeType) ||
      "image/png";
    const maskBase64 = typeof body.maskBase64 === "string" && body.maskBase64 ? body.maskBase64 : undefined;
    const dimensions = typeof body.dimensions === "string" ? body.dimensions : undefined;
    const selectedModelId = body.model || "gemini-25-flash-image";

    if (!prompt) {
      jsonError(response, "Prompt is required", 400);
      return;
    }

    if (!imageBase64) {
      jsonError(response, "Image is required", 400);
      return;
    }
    validateBase64ImageInput(imageBase64);
    if (maskBase64) validateBase64ImageInput(maskBase64);
    if (dimensions && !ALLOWED_IMAGE_DIMENSIONS.includes(dimensions as (typeof ALLOWED_IMAGE_DIMENSIONS)[number])) {
      jsonError(response, "Invalid dimensions", 400);
      return;
    }

    const isAdmin = await hasLocalUserRole(user.id, "admin");
    const modelConfig = await getActiveModelConfig(selectedModelId, "editing");
      const modelProvider = getLegacyProvider(selectedModelId, modelConfig.provider, modelConfig.api_model);
    const apiModel = getLegacyApiModel(selectedModelId, modelConfig.api_model);
    // Editing cost follows the selected server-side model. A client-controlled
    // tool id must not be able to lower or otherwise override that price.
    const editCost = modelConfig.credit_cost || 50;

    activeGenerationJobId = await reserveGenerationJob({
      userId: user.id,
      tier: await getGenerationJobTier(user.id, isAdmin),
      jobType: "edit-image",
      cost: editCost,
      model: selectedModelId,
    });
    await ensureDailyCreditSpendLimit(user.id, editCost, isAdmin);
    await ensureCreditsAvailableLocally(user.id, editCost, isAdmin);

    const apiKey = await getModelApiKey(selectedModelId, modelProvider, apiModel);
    const creditsReserved = await deductCreditsLocally(user.id, editCost, isAdmin);
    reservedCredits = { userId: user.id, cost: editCost, active: creditsReserved };
    const result =
      modelProvider === "openai"
        ? await editWithOpenAI({
            prompt,
            imageBase64,
            imageMimeType,
            maskBase64,
            dimensions,
            apiModel,
            apiKey,
          })
        : await editWithGemini({
            prompt,
            imageBase64,
            imageMimeType,
            maskBase64,
            dimensions,
            apiModel,
            apiKey,
          });

    const saved = await saveGeneratedGraphicToStorage({
      userId: user.id,
      base64: result.base64,
      mimeType: result.mimeType,
      prompt: `[Edycja] ${prompt}`,
      style: "realistic",
      type: "edited",
      dimensions: dimensions ?? null,
      parentGraphicId: body.parentGraphicId ?? null,
    });

    await recordCreditUsage(user.id, editCost, selectedModelId).catch((error) => {
      console.error("VPS AI edit credit usage record error:", error);
    });
    if (reservedCredits) reservedCredits.active = false;
    await finishGenerationJob(activeGenerationJobId, "completed");
    activeGenerationJobId = null;

    response.json({
      imageUrl: saved.imageUrl,
      storagePath: saved.storagePath,
      trimmedCount: saved.trimmedCount,
    });
  } catch (error) {
    if (reservedCredits?.active) {
      await refundCreditsLocally(reservedCredits.userId, reservedCredits.cost, true);
      reservedCredits.active = false;
    }
    await finishGenerationJob(activeGenerationJobId, "failed").catch((jobError) => {
      console.error("VPS AI edit job finish failed:", jobError);
    });
    activeGenerationJobId = null;
    const { message, status } = getSafeErrorMessage(error);
    jsonError(response, message, status);
  }
});

aiRouter.post("/ai/image-to-prompt", requireAuthenticatedUser, aiVisionRateLimit, async (request, response) => {
  let reservedCredits: { userId: string; cost: number; active: boolean } | null = null;
  let activeGenerationJobId: string | null = null;

  try {
    const user = request.authUser!;
    const body = (request.body || {}) as ImageToPromptBody;
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    const imageMimeType = typeof body.imageMimeType === "string" ? body.imageMimeType : "image/png";
    const promptType = typeof body.promptType === "string" ? body.promptType : "universal";
    const outputLanguage = typeof body.outputLanguage === "string" ? body.outputLanguage : "pl";
    const toolId = typeof body.toolId === "string" && body.toolId.trim() ? body.toolId.trim() : "image-to-prompt";

    if (!imageBase64) {
      jsonError(response, "Obraz jest wymagany.", 400);
      return;
    }
    validateBase64ImageInput(imageBase64);

    const isAdmin = await hasLocalUserRole(user.id, "admin");
    const toolCost = await getToolCost(toolId, 25);
    activeGenerationJobId = await reserveGenerationJob({
      userId: user.id,
      tier: await getGenerationJobTier(user.id, isAdmin),
      jobType: "image-to-prompt",
      cost: toolCost,
      model: toolId,
    });
    await ensureDailyCreditSpendLimit(user.id, toolCost, isAdmin);
    await ensureCreditsAvailableLocally(user.id, toolCost, isAdmin);
    const creditsReserved = await deductCreditsLocally(user.id, toolCost, isAdmin);
    reservedCredits = { userId: user.id, cost: toolCost, active: creditsReserved };

    const prompt = await generatePromptFromImage({
      imageBase64,
      imageMimeType,
      promptType,
      outputLanguage,
    });

    await recordCreditUsage(user.id, toolCost, toolId).catch((error) => {
      console.error("VPS image-to-prompt credit usage record error:", error);
    });
    if (reservedCredits) reservedCredits.active = false;
    await finishGenerationJob(activeGenerationJobId, "completed");
    activeGenerationJobId = null;

    response.json({ prompt, creditsUsed: toolCost });
  } catch (error) {
    if (reservedCredits?.active) {
      await refundCreditsLocally(reservedCredits.userId, reservedCredits.cost, true);
      reservedCredits.active = false;
    }
    await finishGenerationJob(activeGenerationJobId, "failed").catch((jobError) => {
      console.error("VPS image-to-prompt job finish failed:", jobError);
    });
    activeGenerationJobId = null;
    const { message, status } = getSafeErrorMessage(error);
    jsonError(response, message, status);
  }
});

aiRouter.post("/ai/ocr", requireAuthenticatedUser, aiVisionRateLimit, async (request, response) => {
  let reservedCredits: { userId: string; cost: number; active: boolean } | null = null;
  let activeGenerationJobId: string | null = null;

  try {
    const user = request.authUser!;
    const body = (request.body || {}) as OcrBody;
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    const imageMimeType = typeof body.imageMimeType === "string" ? body.imageMimeType : "image/png";

    if (!imageBase64) {
      jsonError(response, "Brak obrazu", 400);
      return;
    }
    validateBase64ImageInput(imageBase64);

    const isAdmin = await hasLocalUserRole(user.id, "admin");
    const toolCost = await getToolCost("ocr", 10);
    activeGenerationJobId = await reserveGenerationJob({
      userId: user.id,
      tier: await getGenerationJobTier(user.id, isAdmin),
      jobType: "ocr",
      cost: toolCost,
      model: "ocr",
    });
    await ensureDailyCreditSpendLimit(user.id, toolCost, isAdmin);
    await ensureCreditsAvailableLocally(user.id, toolCost, isAdmin);
    const creditsReserved = await deductCreditsLocally(user.id, toolCost, isAdmin);
    reservedCredits = { userId: user.id, cost: toolCost, active: creditsReserved };

    const text = await extractTextFromImage({ imageBase64, imageMimeType });
    await recordCreditUsage(user.id, toolCost, "ocr").catch((error) => {
      console.error("VPS OCR credit usage record error:", error);
    });
    if (reservedCredits) reservedCredits.active = false;
    await finishGenerationJob(activeGenerationJobId, "completed");
    activeGenerationJobId = null;

    response.json({ text, creditsUsed: toolCost });
  } catch (error) {
    if (reservedCredits?.active) {
      await refundCreditsLocally(reservedCredits.userId, reservedCredits.cost, true);
      reservedCredits.active = false;
    }
    await finishGenerationJob(activeGenerationJobId, "failed").catch((jobError) => {
      console.error("VPS OCR job finish failed:", jobError);
    });
    activeGenerationJobId = null;
    const { message, status } = getSafeErrorMessage(error);
    jsonError(response, message, status);
  }
});
