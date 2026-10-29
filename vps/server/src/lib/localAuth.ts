import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export type LocalAccessTokenPayload = {
  sub: string;
  email: string | null;
  exp: number;
  iat: number;
  iss: string;
  typ: "access";
};

const ISSUER = "kreator-ai-vps";

const base64UrlEncode = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const base64UrlDecode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const signToken = (value: string) =>
  createHmac("sha256", env.jwtAccessSecret || "change_me_access_secret")
    .update(value, "utf8")
    .digest("base64url");

const getNowSeconds = () => Math.floor(Date.now() / 1000);

export const issueLocalAccessToken = ({
  userId,
  email,
  expiresAt,
  expiresIn,
}: {
  userId: string;
  email: string | null;
  expiresAt?: number | null;
  expiresIn?: number | null;
}) => {
  const now = getNowSeconds();
  const exp =
    expiresAt && Number.isFinite(expiresAt)
      ? Number(expiresAt)
      : now + Math.max(Number(expiresIn || env.jwtAccessExpiresSeconds || 3600), 60);

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      email: email ?? null,
      exp,
      iat: now,
      iss: ISSUER,
      typ: "access",
    } satisfies LocalAccessTokenPayload)
  );
  const signature = signToken(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
};

export const verifyLocalAccessToken = (token: string): LocalAccessTokenPayload | null => {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;

  const expectedSignature = signToken(`${header}.${payload}`);
  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as Partial<LocalAccessTokenPayload>;
    if (
      typeof parsed.sub !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= getNowSeconds() ||
      parsed.iss !== ISSUER ||
      parsed.typ !== "access"
    ) {
      return null;
    }

    return {
      sub: parsed.sub,
      email: typeof parsed.email === "string" ? parsed.email : null,
      exp: parsed.exp,
      iat: typeof parsed.iat === "number" ? parsed.iat : getNowSeconds(),
      iss: ISSUER,
      typ: "access",
    };
  } catch {
    return null;
  }
};
