import { Router } from "express";
import { createLocalErrorLog } from "../lib/localAdminAssetsData.js";
import { verifyLocalAccessToken } from "../lib/localAuth.js";
import { getLocalAuthUser } from "../lib/localUserData.js";
import { createRateLimitMiddleware, getRequestClientIp } from "../middleware/rateLimit.js";

type ClientErrorBody = {
  message?: unknown;
  stack?: unknown;
  errorType?: unknown;
  source?: unknown;
  url?: unknown;
  path?: unknown;
  userAgent?: unknown;
  componentStack?: unknown;
  metadata?: unknown;
};

const MAX_TEXT = 2000;
const MAX_STACK = 8000;

const safeText = (value: unknown, max = MAX_TEXT) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const getBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader) return null;
  const [type, token] = authorizationHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

const getOptionalUserId = async (authorizationHeader?: string) => {
  const token = getBearerToken(authorizationHeader);
  if (!token) return null;

  const payload = verifyLocalAccessToken(token);
  if (!payload?.sub) return null;

  const user = await getLocalAuthUser(payload.sub).catch(() => null);
  return user?.user_id || null;
};

const safeMetadata = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const clientErrorsRouter = Router();

const clientErrorsRateLimit = createRateLimitMiddleware({
  scope: "client-errors:report",
  max: 40,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele zgloszen bledow. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) => [`ip:${getRequestClientIp(request)}`],
});

clientErrorsRouter.post("/client-errors/report", clientErrorsRateLimit, async (request, response) => {
  try {
    const body = (request.body || {}) as ClientErrorBody;
    const message = safeText(body.message) || "Frontend error";
    const errorType = safeText(body.errorType, 120) || "frontend-error";
    const source = safeText(body.source, 80) || "frontend";
    const stack = safeText(body.stack, MAX_STACK) || null;
    const userId = await getOptionalUserId(request.header("authorization"));
    const metadata = safeMetadata(body.metadata);

    await createLocalErrorLog({
      source,
      message,
      stack,
      userId,
      context: {
        errorType,
        url: safeText(body.url, 500),
        path: safeText(body.path, 300),
        userAgent: safeText(body.userAgent, 500),
        componentStack: safeText(body.componentStack, MAX_STACK),
        metadata,
        ip: request.ip,
      },
    });

    response.json({ ok: true });
  } catch (error) {
    console.error("Client error report failed:", error);
    response.status(500).json({ ok: false, error: "Nie udało się zapisać błędu frontendu." });
  }
});
