import { Router } from "express";
import {
  deleteLocalCreditPurchasesByUserId,
  deleteLocalCreditUsageByUserId,
  listLocalCreditPurchases,
} from "../lib/localBillingData.js";
import {
  deleteLocalCredentialArtifactsByUserId,
  getLocalCredentialByUserId,
  upsertLocalPasswordCredential,
  verifyLocalPasswordCredential,
} from "../lib/localCredentials.js";
import { deleteGraphicFile, getGraphicDisplayUrl, getGraphicThumbnailDisplayUrl } from "../lib/graphics.js";
import {
  createLocalCompanyAssistantAsset,
  createLocalCompanyAssistantPackage,
  deleteLocalCompanyAssistantAssetForUser,
  deleteLocalCompanyAssistantPackageForUser,
  deleteLocalCompanyAssistantPackagesByUserId,
  listLocalCompanyAssistantAssets,
  listLocalCompanyAssistantPackages,
} from "../lib/localCompanyAssistantData.js";
import { deleteLocalCompanyAssistantSessionsByUserId } from "../lib/localCompanyAssistantSessionsData.js";
import { grantLocalDailyFreeCreditsForUser } from "../lib/localDailyCredits.js";
import { deleteLocalGraphicsByIds, listAllLocalGraphicsByUser, listLocalGraphicsByUser } from "../lib/localGraphicsData.js";
import { deleteLocalErrorLogsByUserId, deleteLocalFavoriteEmojisByUserId } from "../lib/localAdminAssetsData.js";
import {
  deleteLocalAuthUser,
  getLocalAuthUser,
  getLocalDailyFreeUsage,
  getLocalProfile,
  getLocalUserCredit,
  hasLocalUserRole,
  incrementLocalDailyFreeUsage,
  listLocalAllowedAdminTabs,
  listLocalFavoriteTools,
  setLocalFavoriteTool,
  deleteLocalUserMirror,
  upsertLocalProfilesRows,
} from "../lib/localUserData.js";
import { requireAuthenticatedUser } from "../middleware/requireAuthenticatedUser.js";
import {
  buildTotpUri,
  consumeLocalUserRecoveryCode,
  countLocalUserRecoveryCodes,
  disableLocalUserTotp,
  enableLocalUserTotp,
  generateTotpSecret,
  isLocalUserTotpEnabled,
  replaceLocalUserRecoveryCodes,
  verifyLocalUserTotp,
  verifyTotpCode,
} from "../lib/localTwoFactor.js";
import {
  deleteLocalAdPromptSessionForUser,
  deleteLocalAdPromptSessionsByUserId,
  listLocalAdPromptSessions,
} from "../lib/localAdPromptData.js";
import { sendAdminSecurityAlertSoon } from "../lib/securityAlerts.js";

type GraphicRow = {
  id: string;
  url: string | null;
  prompt: string;
  style: string;
  type: string;
  created_at: string;
};

type PurchaseRow = {
  id: string;
  credits: number;
  amount: number;
  paid_amount: number | null;
  status: string;
  created_at: string;
  billing_company: string | null;
};

type DailyFreeUsageRow = {
  id: string;
  count: number;
};

type DeleteAccountBody = {
  confirmText?: string;
  password?: string;
};

type TwoFactorEnableBody = {
  secret?: string;
  code?: string;
};

type TwoFactorDisableBody = {
  password?: string;
  code?: string;
  recoveryCode?: string;
};

type CompanyAssistantPackageBody = {
  companyName?: string;
  industry?: string;
  profile?: Record<string, unknown>;
  prompts?: Array<{
    materialId?: string;
    title?: string;
    format?: string;
    style?: string;
    prompt?: string;
  }>;
};

type CompanyAssistantAssetBody = {
  packageId?: string | null;
  sessionId?: string | null;
  graphicId?: string | null;
  url?: string | null;
  materialId?: string;
  materialTitle?: string;
  assetType?: string;
  prompt?: string;
  dimensions?: string | null;
};

type AdPromptSessionPrompt = {
  title: string;
  hookPl: string;
  prompt: string;
  needsImage: boolean;
  imageNote: string;
};

const ADMIN_TABS = [
  "stats",
  "users",
  "sales",
  "ai",
  "assets",
  "content",
  "emails",
  "errors",
  "audit",
  "settings",
  "purchases",
  "credits",
  "coupons",
  "graphics",
  "models",
  "toolpricing",
  "stripe",
  "mailerlite",
  "emojis",
  "badges",
];

export const meRouter = Router();
const DELETE_ACCOUNT_CONFIRM_PHRASE = "USUN KONTO";

const normalizeFreeUsageFeature = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  return trimmed === "remove_bg" ? trimmed : null;
};

meRouter.get("/me", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const isAdmin = await hasLocalUserRole(user.id, "admin");

    response.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email
      },
      isAdmin
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load current user."
    });
  }
});

meRouter.get("/me/credits", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    await grantLocalDailyFreeCreditsForUser(user.id).catch((error) => {
      console.error("VPS daily free credits auto-grant warning:", error);
    });

    const [creditRow, isAdmin] = await Promise.all([
      getLocalUserCredit(user.id),
      hasLocalUserRole(user.id, "admin"),
    ]);

    response.json({
      ok: true,
      balance: creditRow?.balance ?? 0,
      isAdmin
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load credits."
    });
  }
});

meRouter.get("/me/admin-access", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const isSuperAdmin = await hasLocalUserRole(user.id, "admin");
    const rawTabs = isSuperAdmin ? ADMIN_TABS : await listLocalAllowedAdminTabs(user.id);

    response.json({
      ok: true,
      isSuperAdmin: Boolean(isSuperAdmin),
      rawTabs: Boolean(isSuperAdmin) ? ADMIN_TABS : rawTabs,
      allowedTabs: Boolean(isSuperAdmin) ? ADMIN_TABS : rawTabs,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load admin access.",
    });
  }
});

meRouter.get("/me/graphics", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const limit = Math.min(Math.max(Number(request.query.limit ?? 6), 1), 24);
    const graphics = (await listLocalGraphicsByUser(user.id, { limit })) as GraphicRow[];
    response.json({
      ok: true,
      graphics: await Promise.all(
        graphics.map(async (graphic) => {
          return {
            ...graphic,
            signed_url: await getGraphicDisplayUrl(graphic.url),
            thumbnail_url: await getGraphicThumbnailDisplayUrl(graphic.url),
          };
        })
      )
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load graphics."
    });
  }
});

meRouter.get("/me/profile", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const [profile, purchases] = await Promise.all([
      getLocalProfile(user.id),
      listLocalCreditPurchases({ userId: user.id, limit: 50 }),
    ]);

    response.json({
      ok: true,
      profile: profile || { display_name: null },
      purchases: purchases as PurchaseRow[],
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load profile.",
    });
  }
});

meRouter.get("/me/company-assistant-packages", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const limit = Math.min(Math.max(Number(request.query.limit ?? 20), 1), 50);
    const packages = await listLocalCompanyAssistantPackages(user.id, limit);

    response.json({
      ok: true,
      packages: packages.map((item) => ({
        id: item.id,
        createdAt: item.created_at,
        companyName: item.company_name,
        industry: item.industry,
        profile: item.profile,
        prompts: item.prompts,
      })),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load company assistant packages.",
    });
  }
});

meRouter.get("/me/company-assistant-assets", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const packageId = typeof request.query.packageId === "string" ? request.query.packageId.trim() : "";
    const sessionId = typeof request.query.sessionId === "string" ? request.query.sessionId.trim() : "";
    const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 100);
    const assets = await listLocalCompanyAssistantAssets(user.id, {
      packageId: packageId || null,
      sessionId: sessionId || null,
      limit,
    });

    response.json({
      ok: true,
      assets: await Promise.all(
        assets.map(async (asset) => ({
          id: asset.id,
          packageId: asset.package_id,
          sessionId: asset.session_id,
          graphicId: asset.graphic_id,
          url: asset.url,
          signedUrl: asset.url ? await getGraphicDisplayUrl(asset.url) : null,
          materialId: asset.material_id,
          materialTitle: asset.material_title,
          assetType: asset.asset_type,
          prompt: asset.prompt,
          dimensions: asset.dimensions,
          createdAt: asset.created_at,
        })),
      ),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load company assistant assets.",
    });
  }
});

meRouter.post("/me/company-assistant-packages", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const body = (request.body || {}) as CompanyAssistantPackageBody;
    const prompts = Array.isArray(body.prompts)
      ? body.prompts
          .map((prompt) => ({
            materialId: String(prompt.materialId || ""),
            title: String(prompt.title || ""),
            format: String(prompt.format || ""),
            style: String(prompt.style || ""),
            prompt: String(prompt.prompt || ""),
          }))
          .filter((prompt) => prompt.materialId && prompt.title && prompt.prompt)
      : [];

    if (prompts.length === 0) {
      response.status(400).json({ ok: false, message: "Brak promptow do zapisania." });
      return;
    }

    const saved = await createLocalCompanyAssistantPackage({
      userId: user.id,
      companyName: String(body.companyName || "Firma bez nazwy").slice(0, 200),
      industry: String(body.industry || "Branza nieuzupelniona").slice(0, 200),
      profile: body.profile && typeof body.profile === "object" ? body.profile : {},
      prompts,
    });

    response.json({
      ok: true,
      package: {
        id: saved.id,
        createdAt: saved.created_at,
        companyName: saved.company_name,
        industry: saved.industry,
        profile: saved.profile,
        prompts: saved.prompts,
      },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to save company assistant package.",
    });
  }
});

meRouter.delete("/me/company-assistant-packages/:id", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const packageId = String(request.params.id || "").trim();
    if (!packageId) {
      response.status(400).json({ ok: false, message: "Brak ID pakietu." });
      return;
    }

    const deleted = await deleteLocalCompanyAssistantPackageForUser(user.id, packageId);
    if (!deleted) {
      response.status(404).json({ ok: false, message: "Nie znaleziono pakietu." });
      return;
    }

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to delete company assistant package.",
    });
  }
});

meRouter.post("/me/company-assistant-assets", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const body = (request.body || {}) as CompanyAssistantAssetBody;
    const saved = await createLocalCompanyAssistantAsset({
      userId: user.id,
      packageId: typeof body.packageId === "string" ? body.packageId : null,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      graphicId: typeof body.graphicId === "string" ? body.graphicId : null,
      url: typeof body.url === "string" ? body.url : null,
      materialId: body.materialId,
      materialTitle: body.materialTitle,
      assetType: body.assetType,
      prompt: body.prompt,
      dimensions: typeof body.dimensions === "string" ? body.dimensions : null,
    });

    response.json({ ok: true, asset: saved });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to save company assistant asset.",
    });
  }
});

meRouter.delete("/me/company-assistant-assets/:id", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const assetId = String(request.params.id || "").trim();
    if (!assetId) {
      response.status(400).json({ ok: false, message: "Brak ID elementu." });
      return;
    }

    const deleted = await deleteLocalCompanyAssistantAssetForUser(user.id, assetId);
    if (!deleted) {
      response.status(404).json({ ok: false, message: "Nie znaleziono elementu." });
      return;
    }

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to delete company assistant asset.",
    });
  }
});

meRouter.get("/me/ad-prompt-sessions", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 100);
    const sessions = await listLocalAdPromptSessions(user.id, limit);

    response.json({
      ok: true,
      sessions: sessions.map((session) => ({
        id: session.id,
        inputText: session.input_text,
        imageCount: session.image_count,
        prompts: (Array.isArray(session.prompts) ? session.prompts : []) as AdPromptSessionPrompt[],
        createdAt: session.created_at,
      })),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load ad prompt sessions.",
    });
  }
});

meRouter.delete("/me/ad-prompt-sessions/:id", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const sessionId = String(request.params.id || "").trim();
    if (!sessionId) {
      response.status(400).json({ ok: false, message: "Brak ID historii promptow." });
      return;
    }

    const deleted = await deleteLocalAdPromptSessionForUser(user.id, sessionId);
    if (!deleted) {
      response.status(404).json({ ok: false, message: "Nie znaleziono historii promptow." });
      return;
    }

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to delete ad prompt session.",
    });
  }
});

meRouter.patch("/me/profile", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const displayName = typeof request.body?.displayName === "string" ? request.body.displayName.trim() : "";
    const currentProfile = await getLocalProfile(user.id);

    await upsertLocalProfilesRows([
      {
        id: currentProfile?.id || undefined,
        user_id: user.id,
        email: user.email ?? currentProfile?.email ?? null,
        display_name: displayName,
        created_at: currentProfile?.created_at ?? undefined,
      },
    ]);

    response.json({ ok: true, profile: { display_name: displayName } });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update profile.",
    });
  }
});

meRouter.patch("/me/password", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const password = typeof request.body?.password === "string" ? request.body.password : "";

    if (password.length < 6) {
      response.status(400).json({ ok: false, message: "Haslo musi miec minimum 6 znakow." });
      return;
    }

    const localAuthUser = await getLocalAuthUser(user.id).catch(() => null);
    await upsertLocalPasswordCredential({
      userId: user.id,
      email: user.email ?? localAuthUser?.email ?? null,
      password,
      migratedFrom: "me-password",
    });

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update password.",
    });
  }
});

meRouter.get("/me/2fa/status", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const isAdmin = await hasLocalUserRole(user.id, "admin");
    if (!isAdmin) {
      response.status(403).json({ ok: false, message: "2FA jest dostepne tylko dla administratora." });
      return;
    }

    response.json({
      ok: true,
      enabled: await isLocalUserTotpEnabled(user.id),
      recoveryCodes: await countLocalUserRecoveryCodes(user.id),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load 2FA status.",
    });
  }
});

meRouter.post("/me/2fa/setup", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const isAdmin = await hasLocalUserRole(user.id, "admin");
    if (!isAdmin) {
      response.status(403).json({ ok: false, message: "2FA jest dostepne tylko dla administratora." });
      return;
    }

    const secret = generateTotpSecret();
    response.json({
      ok: true,
      secret,
      otpauthUrl: buildTotpUri({ secret, email: user.email }),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to prepare 2FA setup.",
    });
  }
});

meRouter.post("/me/2fa/enable", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const isAdmin = await hasLocalUserRole(user.id, "admin");
    if (!isAdmin) {
      response.status(403).json({ ok: false, message: "2FA jest dostepne tylko dla administratora." });
      return;
    }

    const { secret, code } = (request.body || {}) as TwoFactorEnableBody;
    if (!secret || !code) {
      response.status(400).json({ ok: false, message: "Brak sekretu albo kodu 2FA." });
      return;
    }

    const verification = verifyTotpCode(secret, code);
    if (!verification.ok || verification.step == null) {
      response.status(400).json({ ok: false, message: "Nieprawidlowy kod 2FA." });
      return;
    }

    await enableLocalUserTotp(user.id, secret, verification.step);
    const recoveryCodes = await replaceLocalUserRecoveryCodes(user.id);
    sendAdminSecurityAlertSoon({
      eventKey: `admin-2fa-enabled:${user.id}:${Date.now()}`,
      title: "Włączono 2FA administratora",
      severity: "info",
      actorEmail: user.email,
      actorUserId: user.id,
      request,
      details: {
        konto: user.email || user.id,
        kodyOdzyskiwania: recoveryCodes.length,
      },
    });
    response.json({ ok: true, enabled: true, recoveryCodes });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to enable 2FA.",
    });
  }
});

meRouter.post("/me/2fa/disable", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const isAdmin = await hasLocalUserRole(user.id, "admin");
    if (!isAdmin) {
      response.status(403).json({ ok: false, message: "2FA jest dostepne tylko dla administratora." });
      return;
    }

    const { password, code, recoveryCode } = (request.body || {}) as TwoFactorDisableBody;
    const credential = await getLocalCredentialByUserId(user.id).catch(() => null);
    if (credential) {
      const validPassword = await verifyLocalPasswordCredential({
        userId: user.id,
        password: String(password || ""),
      }).catch(() => null);

      if (!validPassword) {
        response.status(400).json({ ok: false, message: "Nieprawidlowe haslo." });
        return;
      }
    }

    const validCode = recoveryCode
      ? await consumeLocalUserRecoveryCode(user.id, String(recoveryCode || ""))
      : await verifyLocalUserTotp(user.id, String(code || ""), { markUsed: true });
    if (!validCode) {
      sendAdminSecurityAlertSoon({
        eventKey: `admin-2fa-disable-failed:${user.id}`,
        title: "Nieudana próba wyłączenia 2FA",
        severity: "critical",
        actorEmail: user.email,
        actorUserId: user.id,
        request,
        cooldownMinutes: 15,
      });
      response.status(400).json({ ok: false, message: "Nieprawidlowy kod 2FA." });
      return;
    }

    await disableLocalUserTotp(user.id);
    sendAdminSecurityAlertSoon({
      eventKey: `admin-2fa-disabled:${user.id}:${Date.now()}`,
      title: "Wyłączono 2FA administratora",
      severity: "critical",
      actorEmail: user.email,
      actorUserId: user.id,
      request,
      details: {
        konto: user.email || user.id,
      },
    });
    response.json({ ok: true, enabled: false });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to disable 2FA.",
    });
  }
});

meRouter.post("/me/2fa/recovery-codes/regenerate", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const isAdmin = await hasLocalUserRole(user.id, "admin");
    if (!isAdmin) {
      response.status(403).json({ ok: false, message: "Kody odzyskiwania sa dostepne tylko dla administratora." });
      return;
    }

    const twoFactorEnabled = await isLocalUserTotpEnabled(user.id);
    if (!twoFactorEnabled) {
      response.status(400).json({ ok: false, message: "Najpierw wlacz 2FA." });
      return;
    }

    const { code, recoveryCode } = (request.body || {}) as TwoFactorDisableBody;
    const validCode = recoveryCode
      ? await consumeLocalUserRecoveryCode(user.id, String(recoveryCode || ""))
      : await verifyLocalUserTotp(user.id, String(code || ""), { markUsed: true });
    if (!validCode) {
      response.status(400).json({ ok: false, message: "Nieprawidlowy kod 2FA albo kod odzyskiwania." });
      return;
    }

    const recoveryCodes = await replaceLocalUserRecoveryCodes(user.id);
    sendAdminSecurityAlertSoon({
      eventKey: `admin-2fa-recovery-regenerated:${user.id}:${Date.now()}`,
      title: "Wygenerowano nowe kody odzyskiwania 2FA",
      severity: "critical",
      actorEmail: user.email,
      actorUserId: user.id,
      request,
      details: {
        konto: user.email || user.id,
        liczbaKodow: recoveryCodes.length,
      },
    });

    response.json({ ok: true, recoveryCodes });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to regenerate recovery codes.",
    });
  }
});

meRouter.delete("/me/account", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const { confirmText, password } = (request.body || {}) as DeleteAccountBody;
    const normalizedConfirmText = typeof confirmText === "string" ? confirmText.trim().toUpperCase() : "";

    if (normalizedConfirmText !== DELETE_ACCOUNT_CONFIRM_PHRASE) {
      response.status(400).json({
        ok: false,
        message: `Aby usunac konto wpisz "${DELETE_ACCOUNT_CONFIRM_PHRASE}".`,
      });
      return;
    }

    const localCredential = await getLocalCredentialByUserId(user.id).catch(() => null);
    if (localCredential) {
      const passwordValue = typeof password === "string" ? password : "";
      if (!passwordValue) {
        response.status(400).json({
          ok: false,
          message: "Podaj aktualne haslo, aby usunac konto.",
        });
        return;
      }

      const verifiedCredential = await verifyLocalPasswordCredential({
        userId: user.id,
        password: passwordValue,
      }).catch(() => null);

      if (!verifiedCredential) {
        response.status(401).json({
          ok: false,
          message: "Nieprawidlowe haslo.",
        });
        return;
      }
    }

    const graphics = await listAllLocalGraphicsByUser(user.id);
    const graphicIds = graphics.map((graphic) => graphic.id);

    await Promise.all([
      deleteLocalCreditUsageByUserId(user.id),
      deleteLocalCreditPurchasesByUserId(user.id),
      deleteLocalFavoriteEmojisByUserId(user.id),
      deleteLocalErrorLogsByUserId(user.id),
      deleteLocalCompanyAssistantPackagesByUserId(user.id),
      deleteLocalCompanyAssistantSessionsByUserId(user.id),
      deleteLocalAdPromptSessionsByUserId(user.id),
      deleteLocalGraphicsByIds(graphicIds),
      deleteLocalCredentialArtifactsByUserId(user.id),
      deleteLocalUserMirror(user.id),
      deleteLocalAuthUser(user.id),
    ]);

    await Promise.allSettled(graphics.map((graphic) => deleteGraphicFile(graphic.url)));

    response.json({
      ok: true,
      deletedGraphics: graphicIds.length,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to delete account.",
    });
  }
});

meRouter.get("/me/favorite-tools", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const rows = await listLocalFavoriteTools(user.id);

    response.json({
      ok: true,
      favorites: rows.map((row) => row.tool_id),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load favorite tools.",
    });
  }
});

meRouter.post("/me/favorite-tools/toggle", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const { toolId, favorite } = request.body as { toolId?: string; favorite?: boolean };

    if (!toolId) {
      response.status(400).json({ ok: false, message: "toolId is required." });
      return;
    }

    const shouldFavorite = Boolean(favorite);
    await setLocalFavoriteTool(user.id, toolId, shouldFavorite);
    response.json({ ok: true, favorite: shouldFavorite });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update favorite tools.",
    });
  }
});

meRouter.get("/me/free-usage/:feature", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const feature = normalizeFreeUsageFeature(String(request.params.feature || ""));

    if (!feature) {
      response.status(400).json({ ok: false, message: "Nieznana funkcja darmowego limitu." });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const data = await getLocalDailyFreeUsage(user.id, feature, today);

    response.json({
      ok: true,
      feature,
      usageDate: today,
      count: (data as DailyFreeUsageRow | null)?.count ?? 0,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load free usage.",
    });
  }
});

meRouter.post("/me/free-usage/:feature/increment", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const feature = normalizeFreeUsageFeature(String(request.params.feature || ""));

    if (!feature) {
      response.status(400).json({ ok: false, message: "Nieznana funkcja darmowego limitu." });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const updatedUsage = await incrementLocalDailyFreeUsage(user.id, feature, today);

    if (!updatedUsage) {
      response.status(503).json({ ok: false, message: "Local database is required for free usage tracking." });
      return;
    }

    response.json({
      ok: true,
      feature,
      usageDate: today,
      count: updatedUsage.count,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update free usage.",
    });
  }
});
