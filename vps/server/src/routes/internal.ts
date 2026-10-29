import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import { grantLocalDailyFreeCredits } from "../lib/localDailyCredits.js";
import { verifyLocalAccessToken } from "../lib/localAuth.js";
import { hasLocalUserRole } from "../lib/localUserData.js";
import { todoRoute } from "../lib/todoRoute.js";

export const internalRouter = Router();

const getBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader) return null;
  const [type, token] = authorizationHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

const secureCompare = (left: string, right: string) => {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
};

const authorizeDailyCreditsRequest = async (authorizationHeader?: string, cronSecretHeader?: string | null) => {
  if (env.cronSecret && cronSecretHeader && secureCompare(env.cronSecret, cronSecretHeader)) {
    return { mode: "cron" as const, userId: null };
  }

  const accessToken = getBearerToken(authorizationHeader);
  if (!accessToken) return null;

  const localPayload = verifyLocalAccessToken(accessToken);
  if (localPayload?.sub) {
    const isAdmin = await hasLocalUserRole(localPayload.sub, "admin");
    return isAdmin ? { mode: "admin" as const, userId: localPayload.sub } : null;
  }
  return null;
};

internalRouter.post("/internal/jobs/daily-credits", async (request, response) => {
  try {
    const authResult = await authorizeDailyCreditsRequest(
      request.header("authorization"),
      request.header("x-cron-secret")
    );

    if (!authResult) {
      response.status(401).json({
        ok: false,
        error: "Unauthorized",
      });
      return;
    }

    const force = authResult.mode === "admin" && Boolean(request.body?.force);
    const result = await grantLocalDailyFreeCredits({ force });

    response.json({
      ok: true,
      ...result,
      triggeredBy: authResult.mode,
    });
  } catch (error) {
    console.error("VPS daily credits job error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie przyznac darmowych kredytow.",
    });
  }
});

internalRouter.post("/security/captcha/verify", todoRoute({ scope: "internal", action: "verify captcha" }));
