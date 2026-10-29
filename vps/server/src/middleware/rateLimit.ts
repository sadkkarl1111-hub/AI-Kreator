import type { Request, RequestHandler } from "express";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitConfig = {
  scope: string;
  max: number;
  windowMs: number;
  message: string;
  keyResolver: (request: Request) => string[];
};

const rateLimitStore = new Map<string, RateLimitEntry>();
let lastCleanupAt = 0;

const normalizeKeyPart = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
};

const cleanupRateLimitStore = (now: number) => {
  if (now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
};

export const getRequestClientIp = (request: Request) => {
  const forwardedHeader = request.header("x-forwarded-for");
  const forwardedValue = Array.isArray(forwardedHeader) ? forwardedHeader[0] : forwardedHeader;
  const firstForwarded = String(forwardedValue || "")
    .split(",")
    .map((part) => part.trim())
    .find(Boolean);

  return firstForwarded || request.ip || "127.0.0.1";
};

export const normalizeRateLimitEmail = (value: unknown) => {
  const normalized = normalizeKeyPart(value);
  if (!normalized || !normalized.includes("@")) return null;
  return normalized;
};

export const createRateLimitMiddleware = (config: RateLimitConfig): RequestHandler => {
  return (request, response, next) => {
    const now = Date.now();
    cleanupRateLimitStore(now);

    const resolvedKeys = Array.from(
      new Set(
        config
          .keyResolver(request)
          .map((key) => normalizeKeyPart(key))
          .filter((key): key is string => Boolean(key))
      )
    );

    if (!resolvedKeys.length) {
      next();
      return;
    }

    const scopedKeys = resolvedKeys.map((key) => `${config.scope}:${key}`);
    const entries = scopedKeys.map((key) => {
      const existingEntry = rateLimitStore.get(key);
      if (!existingEntry || existingEntry.resetAt <= now) {
        const freshEntry: RateLimitEntry = {
          count: 0,
          resetAt: now + config.windowMs,
        };
        rateLimitStore.set(key, freshEntry);
        return freshEntry;
      }

      return existingEntry;
    });

    const blockedEntry = entries.find((entry) => entry.count >= config.max);
    if (blockedEntry) {
      const retryAfterSeconds = Math.max(1, Math.ceil((blockedEntry.resetAt - now) / 1000));
      response.setHeader("Retry-After", String(retryAfterSeconds));
      response.setHeader("X-RateLimit-Limit", String(config.max));
      response.setHeader("X-RateLimit-Remaining", "0");
      response.setHeader("X-RateLimit-Reset", String(Math.ceil(blockedEntry.resetAt / 1000)));
      response.status(429).json({
        ok: false,
        error: config.message,
        retryAfterSeconds,
      });
      return;
    }

    let remaining = config.max;
    let resetAt = now + config.windowMs;

    entries.forEach((entry) => {
      entry.count += 1;
      remaining = Math.min(remaining, Math.max(config.max - entry.count, 0));
      resetAt = Math.min(resetAt, entry.resetAt);
    });

    response.setHeader("X-RateLimit-Limit", String(config.max));
    response.setHeader("X-RateLimit-Remaining", String(remaining));
    response.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

    next();
  };
};
