import { Router } from "express";
import { getGraphicDisplayUrl, getGraphicThumbnailDisplayUrl } from "../lib/graphics.js";
import {
  getLocalSettingsMap,
  getLocalSiteContentBySlug,
  listLocalPublicAiModels,
  listLocalPublicToolPricing,
} from "../lib/localCoreData.js";
import { getLocalGraphicByPublicToken, listLocalPublicGraphics } from "../lib/localGraphicsData.js";

export const publicRouter = Router();

const PUBLIC_SETTING_KEYS = new Set([
  "app_base_url",
  "app_generator_url",
  "app_reset_password_url",
  "captcha_provider",
  "captcha_site_key",
  "cookieyes_script",
  "google_oauth_client_id",
  "maintenance_mode_enabled",
  "maintenance_mode_start",
  "maintenance_mode_end",
]);

const CONTENT_SLUGS = new Set(["terms", "privacy"]);

const normalizePurpose = (value: unknown) => {
  if (value === "generation" || value === "editing") return value;
  return null;
};

type PublicAiModelRow = {
  id: string;
  name: string;
  model_id: string;
  provider: string | null;
  credit_cost: number | null;
  active?: boolean;
  sort_order: number | null;
  api_model?: string | null;
  supports_generation?: boolean;
  supports_editing?: boolean;
  supports_reference_images?: boolean;
};

type PublicGraphicRow = {
  id: string;
  url: string | null;
  prompt: string;
  style: string;
  created_at: string;
  user_id: string | null;
};

type SharedGraphicRow = {
  id: string;
  url: string | null;
  prompt: string;
  style: string;
  created_at: string;
  public_token: string | null;
  is_public: boolean | null;
};

publicRouter.get("/public/settings", async (request, response) => {
  try {
    const requestedKeys = String(request.query.keys || "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
    const keys = requestedKeys.length
      ? requestedKeys.filter((key) => PUBLIC_SETTING_KEYS.has(key))
      : Array.from(PUBLIC_SETTING_KEYS);

    if (keys.length === 0) {
      response.json({ ok: true, settings: {} });
      return;
    }

    response.json({
      ok: true,
      settings: await getLocalSettingsMap(keys),
    });
  } catch (error) {
    console.error("VPS public settings error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie pobrac ustawien.",
    });
  }
});

publicRouter.get("/public/content/:slug", async (request, response) => {
  try {
    const slug = request.params.slug;
    if (!CONTENT_SLUGS.has(slug)) {
      response.status(404).json({ ok: false, error: "Nieznana strona." });
      return;
    }

    response.json({ ok: true, content: await getLocalSiteContentBySlug(slug) });
  } catch (error) {
    console.error("VPS public content error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie pobrac tresci.",
    });
  }
});

publicRouter.get("/public/ai-models", async (request, response) => {
  try {
    const purpose = normalizePurpose(request.query.purpose);
    const models = await listLocalPublicAiModels(purpose);
    response.json({ ok: true, models: (models as PublicAiModelRow[]) || [] });
  } catch (error) {
    console.error("VPS public AI models error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie pobrac modeli AI.",
    });
  }
});

publicRouter.get("/public/tool-pricing", async (_request, response) => {
  try {
    response.json({ ok: true, tools: await listLocalPublicToolPricing() });
  } catch (error) {
    console.error("VPS public tool pricing error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie pobrac cennika narzedzi.",
    });
  }
});

publicRouter.get("/public/gallery", async (request, response) => {
  try {
    const limit = Math.min(Math.max(Number(request.query.limit ?? 12), 1), 48);
    const data = await listLocalPublicGraphics(limit);

    const graphics = await Promise.all(
      (data as PublicGraphicRow[]).map(async (graphic) => ({
        ...graphic,
        signed_url: await getGraphicDisplayUrl(graphic.url),
        thumbnail_url: await getGraphicThumbnailDisplayUrl(graphic.url),
      }))
    );

    response.json({ ok: true, graphics });
  } catch (error) {
    console.error("VPS public gallery error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie pobrac galerii publicznej.",
    });
  }
});

publicRouter.get("/public/shared-graphic/:token", async (request, response) => {
  try {
    const token = String(request.params.token || "").trim();
    if (!token) {
      response.status(400).json({ ok: false, error: "Brak tokenu udostepnienia." });
      return;
    }

    const graphic = (await getLocalGraphicByPublicToken(token)) as SharedGraphicRow | null;
    if (!graphic || (!graphic.is_public && !graphic.public_token)) {
      response.status(404).json({ ok: false, error: "Grafika nie zostala znaleziona." });
      return;
    }

    response.json({
      ok: true,
      graphic: {
        ...graphic,
        signed_url: await getGraphicDisplayUrl(graphic.url),
        thumbnail_url: await getGraphicThumbnailDisplayUrl(graphic.url),
      },
    });
  } catch (error) {
    console.error("VPS public shared graphic error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie pobrac grafiki.",
    });
  }
});
