import { Router } from "express";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { getLocalEmailTemplateBySlug, getLocalSettingsMap } from "../lib/localCoreData.js";
import { issueLocalAccessToken, verifyLocalAccessToken } from "../lib/localAuth.js";
import {
  getLocalCredentialByUserId,
  deleteLocalCredentialArtifactsByUserId,
  issueLocalRefreshToken,
  revokeLocalRefreshToken,
  rotateLocalRefreshToken,
  upsertLocalPasswordCredential,
  verifyLocalPasswordCredential,
} from "../lib/localCredentials.js";
import {
  consumeLocalPasswordResetToken,
  getLocalPasswordResetToken,
  issueLocalPasswordResetToken,
} from "../lib/localPasswordReset.js";
import {
  confirmLocalUserEmail,
  consumeLocalEmailConfirmationToken,
  issueLocalEmailConfirmationToken,
} from "../lib/localEmailConfirmation.js";
import { sendResetPasswordEmail } from "../lib/passwordResetEmail.js";
import { ensureLocalDatabaseSchema, getPostgresPool, hasLocalDatabase } from "../lib/postgres.js";
import {
  deleteLocalAuthUser,
  deleteLocalUserMirror,
  getLocalAuthUser,
  getLocalAuthUserByEmail,
  hasLocalUserRole,
  upsertLocalAuthUsersRows,
  upsertLocalProfilesRows,
} from "../lib/localUserData.js";
import { consumeLocalUserRecoveryCode, isLocalUserTotpEnabled, verifyLocalUserTotp } from "../lib/localTwoFactor.js";
import { sendAdminSecurityAlertSoon } from "../lib/securityAlerts.js";
import {
  createRateLimitMiddleware,
  getRequestClientIp,
  normalizeRateLimitEmail,
} from "../middleware/rateLimit.js";

export const authRouter = Router();

const VERIFY_URLS: Record<string, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  recaptcha: "https://www.google.com/recaptcha/api/siteverify",
  hcaptcha: "https://api.hcaptcha.com/siteverify",
};

type AuthEmailBody = {
  type?: "signup" | "reset";
  email?: string;
};

type AuthRegisterBody = {
  email?: string;
  password?: string;
  marketingConsent?: boolean;
  captchaToken?: string | null;
};

type AuthLoginBody = {
  email?: string;
  password?: string;
  returnTo?: string;
};

type AuthTwoFactorVerifyBody = {
  challengeToken?: string;
  code?: string;
  recoveryCode?: string;
};

type AuthRefreshBody = {
  refreshToken?: string;
};

type AuthLogoutBody = {
  accessToken?: string;
  refreshToken?: string | null;
};

type AuthSessionFromTokenBody = {
  accessToken?: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  expiresIn?: number | null;
  tokenType?: string | null;
};

type AuthPasswordResetConfirmBody = {
  accessToken?: string;
  password?: string;
};

type AuthPasswordResetVerifyBody = {
  tokenHash?: string;
  type?: string;
};

type AuthGoogleCallbackBody = {
  code?: string;
  state?: string;
};

type TemplateVars = Record<string, string>;

type GoogleOAuthState = {
  nonce: string;
  returnTo: string;
  ts: number;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleIdTokenPayload = {
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
  exp?: number;
  iat?: number;
  iss?: string;
  name?: string;
  picture?: string;
  sub?: string;
 };

type AuthUserLike = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

type AuthSessionLike = {
  user?: AuthUserLike | null;
  refresh_token?: string | null;
  token_type?: string | null;
  expires_at?: number | null;
  expires_in?: number | null;
};

const RESEND_API = "https://api.resend.com/emails";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const TWO_FACTOR_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const INITIAL_SIGNUP_CREDITS = 75;
const SIGNUP_BONUS_IP_ALREADY_CLAIMED = "signup_bonus_ip_already_claimed";

class SignupBonusIpAlreadyClaimedError extends Error {
  constructor() {
    super("Darmowe kredyty startowe zostaly juz wykorzystane z tego adresu IP.");
    this.name = "SignupBonusIpAlreadyClaimedError";
  }
}

const isSignupBonusIpAlreadyClaimedError = (error: unknown) =>
  error instanceof SignupBonusIpAlreadyClaimedError ||
  (error instanceof Error && error.message === SIGNUP_BONUS_IP_ALREADY_CLAIMED);

const normalizeSignupClientIp = (value?: string | null) => {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;

  const forwardedIp = trimmed.split(",")[0]?.trim() || "";
  const withoutIpv6Brackets = forwardedIp.replace(/^\[|\]$/g, "");
  return withoutIpv6Brackets.replace(/^::ffff:/, "") || null;
};

const hashSignupClientIp = (value?: string | null) => {
  const normalizedIp = normalizeSignupClientIp(value);
  if (!normalizedIp) return null;

  return createHmac("sha256", env.jwtRefreshSecret || env.jwtAccessSecret || "signup-bonus-ip")
    .update(normalizedIp, "utf8")
    .digest("hex");
};

const compactRateLimitKeys = (...values: Array<string | null | undefined>) =>
  values.filter((value): value is string => Boolean(value));

const authCaptchaRateLimit = createRateLimitMiddleware({
  scope: "auth:captcha",
  max: 20,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele prob weryfikacji captcha. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) => compactRateLimitKeys(`ip:${getRequestClientIp(request)}`),
});

const authEmailRateLimit = createRateLimitMiddleware({
  scope: "auth:email",
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: "Zbyt wiele prob wysylki wiadomosci. Sprobuj ponownie za kilkanascie minut.",
  keyResolver: (request) => {
    const email = normalizeRateLimitEmail((request.body as AuthEmailBody)?.email);
    return compactRateLimitKeys(`ip:${getRequestClientIp(request)}`, email ? `email:${email}` : null);
  },
});

const authRegisterRateLimit = createRateLimitMiddleware({
  scope: "auth:register",
  max: 5,
  windowMs: 20 * 60 * 1000,
  message: "Zbyt wiele prob rejestracji. Sprobuj ponownie za kilkanascie minut.",
  keyResolver: (request) => {
    const email = normalizeRateLimitEmail((request.body as AuthRegisterBody)?.email);
    return compactRateLimitKeys(`ip:${getRequestClientIp(request)}`, email ? `email:${email}` : null);
  },
});

const authLoginRateLimit = createRateLimitMiddleware({
  scope: "auth:login",
  max: 10,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele prob logowania. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) => {
    const email = normalizeRateLimitEmail((request.body as AuthLoginBody)?.email);
    return compactRateLimitKeys(`ip:${getRequestClientIp(request)}`, email ? `email:${email}` : null);
  },
});

const authRefreshRateLimit = createRateLimitMiddleware({
  scope: "auth:refresh",
  max: 30,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele prob odswiezania sesji. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) => compactRateLimitKeys(`ip:${getRequestClientIp(request)}`),
});

const authPasswordResetRequestRateLimit = createRateLimitMiddleware({
  scope: "auth:password-reset:request",
  max: 5,
  windowMs: 30 * 60 * 1000,
  message: "Zbyt wiele prob resetu hasla. Sprobuj ponownie za jakis czas.",
  keyResolver: (request) => {
    const email = normalizeRateLimitEmail((request.body as AuthEmailBody)?.email);
    return compactRateLimitKeys(`ip:${getRequestClientIp(request)}`, email ? `email:${email}` : null);
  },
});

const authPasswordResetVerifyRateLimit = createRateLimitMiddleware({
  scope: "auth:password-reset:verify",
  max: 20,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele prob weryfikacji linku resetujacego. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) => compactRateLimitKeys(`ip:${getRequestClientIp(request)}`),
});

const authPasswordResetConfirmRateLimit = createRateLimitMiddleware({
  scope: "auth:password-reset:confirm",
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: "Zbyt wiele prob zmiany hasla. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) => compactRateLimitKeys(`ip:${getRequestClientIp(request)}`),
});

const replaceVariables = (template: string, vars: TemplateVars) => {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
};

const loadSettings = async (keys: string[]) => {
  return getLocalSettingsMap(keys);
};

const normalizeBaseUrl = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
};

const normalizeReturnTo = (value?: string | null) => {
  const trimmed = value?.trim();
  const normalizedSeparators = trimmed?.replace(/\\/g, "/");

  if (
    !trimmed ||
    !normalizedSeparators ||
    !normalizedSeparators.startsWith("/") ||
    normalizedSeparators.startsWith("//") ||
    normalizedSeparators.toLowerCase().startsWith("/auth") ||
    /[\u0000-\u001f\u007f]/.test(normalizedSeparators)
  ) {
    return "/";
  }

  return normalizedSeparators;
};

const loadAppUrlSettings = async () => {
  const settings = await loadSettings(["app_base_url", "app_generator_url", "app_reset_password_url"]);
  const appBaseUrl = normalizeBaseUrl(settings.app_base_url) || normalizeBaseUrl(env.appUrl) || "https://ai-kreator.pl";

  return {
    appBaseUrl,
    generatorUrl: normalizeBaseUrl(settings.app_generator_url) || `${appBaseUrl}/generator`,
    resetPasswordUrl: normalizeBaseUrl(settings.app_reset_password_url) || `${appBaseUrl}/reset-password`,
  };
};

const loadGoogleOAuthSettings = async () => {
  const [settings, appUrls] = await Promise.all([
    loadSettings(["google_oauth_client_id", "google_oauth_client_secret"]),
    loadAppUrlSettings(),
  ]);

  const clientId = settings.google_oauth_client_id?.trim() || env.googleClientId;
  const clientSecret = settings.google_oauth_client_secret?.trim() || env.googleClientSecret;
  const callbackUrl = `${appUrls.appBaseUrl}/auth/callback`;

  return {
    appBaseUrl: appUrls.appBaseUrl,
    callbackUrl,
    clientId,
    clientSecret,
  };
};

const loadEmailSettings = async () => {
  const settings = await loadSettings([
    "email_provider",
    "email_from",
    "email_webhook_url",
    "email_webhook_token",
    "resend_api_key",
  ]);

  return {
    provider: settings.email_provider === "webhook" ? "webhook" : settings.email_provider?.trim() || env.emailProvider,
    from: settings.email_from?.trim() || env.emailFrom,
    resendApiKey: settings.resend_api_key?.trim() || env.resendApiKey,
    webhookUrl: settings.email_webhook_url?.trim() || env.emailWebhookUrl,
    webhookToken: settings.email_webhook_token?.trim() || env.emailWebhookToken,
  };
};

const sendTransactionalEmail = async (payload: { to: string; subject: string; html: string }) => {
  const settings = await loadEmailSettings();

  if (settings.provider === "webhook") {
    if (!settings.webhookUrl) throw new Error("Brak EMAIL_WEBHOOK_URL w konfiguracji VPS.");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.webhookToken) headers.Authorization = `Bearer ${settings.webhookToken}`;

    const response = await fetch(settings.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: settings.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) throw new Error(`Email webhook zwrocil blad ${response.status}.`);
    return response.json().catch(() => ({ ok: true }));
  }

  if (!settings.resendApiKey) throw new Error("Brak RESEND_API_KEY w konfiguracji VPS.");

  const response = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: settings.from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("VPS Resend error:", data);
    throw new Error(`Resend zwrocil blad ${response.status}.`);
  }
  return data;
};

const base64UrlEncode = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const base64UrlDecode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const signGoogleStatePayload = (payload: string) =>
  createHmac("sha256", env.jwtAccessSecret || env.jwtRefreshSecret || "google-oauth-state")
    .update(payload)
    .digest("base64url");

const signTwoFactorChallengePayload = (payload: string) =>
  createHmac("sha256", env.jwtAccessSecret || env.jwtRefreshSecret || "two-factor-challenge")
    .update(payload)
    .digest("base64url");

const buildTwoFactorChallengeToken = (input: { userId: string; email: string | null; returnTo?: string | null }) => {
  const payload = base64UrlEncode(
    JSON.stringify({
      userId: input.userId,
      email: input.email,
      returnTo: normalizeReturnTo(input.returnTo || "/dashboard"),
      ts: Date.now(),
    })
  );
  return `${payload}.${signTwoFactorChallengePayload(payload)}`;
};

const parseTwoFactorChallengeToken = (value?: string | null) => {
  if (!value) throw new Error("Brak tokenu 2FA.");

  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("Nieprawidlowy token 2FA.");

  const expectedSignature = signTwoFactorChallengePayload(payload);
  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("Nieprawidlowy podpis tokenu 2FA.");
  }

  const parsed = JSON.parse(base64UrlDecode(payload)) as {
    userId?: string;
    email?: string | null;
    returnTo?: string;
    ts?: number;
  };

  if (!parsed.userId || !parsed.ts || Date.now() - parsed.ts > TWO_FACTOR_CHALLENGE_TTL_MS) {
    throw new Error("Kod 2FA wygasl. Zaloguj sie ponownie.");
  }

  return {
    userId: parsed.userId,
    email: typeof parsed.email === "string" ? parsed.email : null,
    returnTo: normalizeReturnTo(parsed.returnTo),
  };
};

const buildGoogleOAuthState = (returnTo: string) => {
  const state: GoogleOAuthState = {
    nonce: randomBytes(16).toString("hex"),
    returnTo: normalizeReturnTo(returnTo),
    ts: Date.now(),
  };

  const payload = base64UrlEncode(JSON.stringify(state));
  const signature = signGoogleStatePayload(payload);
  return `${payload}.${signature}`;
};

const parseGoogleOAuthState = (value?: string | null) => {
  if (!value) {
    throw new Error("Brak state w odpowiedzi Google.");
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    throw new Error("Nieprawidlowy state logowania Google.");
  }

  const expectedSignature = signGoogleStatePayload(payload);
  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("Nieprawidlowy podpis state logowania Google.");
  }

  const parsed = JSON.parse(base64UrlDecode(payload)) as GoogleOAuthState;
  if (!parsed.ts || Date.now() - parsed.ts > GOOGLE_OAUTH_STATE_TTL_MS) {
    throw new Error("Sesja logowania Google wygasla. Sprobuj ponownie.");
  }

  return {
    ...parsed,
    returnTo: normalizeReturnTo(parsed.returnTo),
  };
};

const buildAuthErrorRedirectUrl = (appBaseUrl: string, message: string) => {
  const url = new URL("/auth", `${appBaseUrl}/`);
  url.searchParams.set("auth_error", message);
  return url.toString();
};

const buildSessionRedirectUrl = (
  appBaseUrl: string,
  returnTo: string,
  session: {
    accessToken: string;
    expiresAt: number | null;
    expiresIn: number | null;
    refreshToken: string | null;
    tokenType: string;
  }
) => {
  const target = new URL(normalizeReturnTo(returnTo), `${appBaseUrl}/`);
  const hash = new URLSearchParams({
    access_token: session.accessToken,
    expires_at: String(session.expiresAt ?? ""),
    expires_in: String(session.expiresIn ?? ""),
    refresh_token: session.refreshToken ?? "",
    token_type: session.tokenType,
  });

  target.hash = hash.toString();
  return target.toString();
};

const decodeGoogleIdTokenPayload = (idToken: string) => {
  const [, payload] = idToken.split(".");
  if (!payload) {
    throw new Error("Google nie zwrocil prawidlowego tokenu ID.");
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GoogleIdTokenPayload;
  } catch {
    throw new Error("Nie udalo sie odczytac danych konta Google.");
  }
};

const resolveLocalGoogleUser = async (email: string, signupClientIp?: string | null) => {
  const normalizedEmail = email.trim().toLowerCase();
  const existingLocalAuthUser = await getLocalAuthUserByEmail(normalizedEmail).catch(() => null);
  const timestamp = new Date().toISOString();

  if (existingLocalAuthUser?.user_id) {
    await syncLocalUserMirror({
      id: existingLocalAuthUser.user_id,
      email: normalizedEmail,
      email_confirmed_at: existingLocalAuthUser.email_confirmed_at ?? timestamp,
      created_at: existingLocalAuthUser.created_at ?? timestamp,
      last_sign_in_at: timestamp,
    });

    return {
      userId: existingLocalAuthUser.user_id,
      email: normalizedEmail,
    };
  }

  const createdLocalUser = await createLocalRegisteredUser(normalizedEmail, {
    signupClientIp,
    emailConfirmedAt: timestamp,
  });
  if (!createdLocalUser?.userId) {
    throw new Error("Lokalna baza uzytkownikow nie jest dostepna.");
  }

  return {
    userId: createdLocalUser.userId,
    email: normalizedEmail,
  };
};

const exchangeGoogleCodeForSession = async (
  code: string,
  stateValue?: string | null,
  signupClientIp?: string | null
) => {
  const googleSettings = await loadGoogleOAuthSettings();
  const state = parseGoogleOAuthState(stateValue);

  if (!googleSettings.clientId || !googleSettings.clientSecret) {
    throw new Error("Google OAuth nie jest jeszcze skonfigurowany na VPS.");
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: googleSettings.clientId,
      client_secret: googleSettings.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleSettings.callbackUrl,
    }).toString(),
  });

  const tokenData = (await tokenResponse.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!tokenResponse.ok || !tokenData?.id_token) {
    const details = tokenData?.error_description || tokenData?.error || `Google token HTTP ${tokenResponse.status}`;
    throw new Error(`Nie udalo sie zakonczyc logowania Google. ${details}`);
  }

  const googleUser = decodeGoogleIdTokenPayload(tokenData.id_token);
  const email = googleUser.email?.trim().toLowerCase();
  const emailVerified = googleUser.email_verified === true || googleUser.email_verified === "true";
  const validIssuer = googleUser.iss === "https://accounts.google.com" || googleUser.iss === "accounts.google.com";

  if (!email || !emailVerified || !validIssuer) {
    throw new Error("Konto Google nie ma potwierdzonego adresu email.");
  }

  const localGoogleUser = await resolveLocalGoogleUser(email, signupClientIp);
  const isAdmin = await hasLocalUserRole(localGoogleUser.userId, "admin");
  const requiresTwoFactor = isAdmin && (await isLocalUserTotpEnabled(localGoogleUser.userId));
  if (requiresTwoFactor) {
    return {
      appBaseUrl: googleSettings.appBaseUrl,
      redirectTo: state.returnTo,
      requiresTwoFactor: true,
      twoFactorToken: buildTwoFactorChallengeToken({
        userId: localGoogleUser.userId,
        email: localGoogleUser.email,
        returnTo: state.returnTo,
      }),
      session: null,
    };
  }

  const localSession = await buildLocalSessionForUser({
    userId: localGoogleUser.userId,
    email: localGoogleUser.email,
  });

  if (!localSession) {
    throw new Error("Nie udalo sie przygotowac sesji po logowaniu Google.");
  }

  if (isAdmin) {
    sendAdminSecurityAlertSoon({
      eventKey: `admin-google-login:${localGoogleUser.userId}:${signupClientIp || "unknown"}`,
      title: "Logowanie administratora przez Google",
      severity: "warning",
      actorEmail: localGoogleUser.email,
      actorUserId: localGoogleUser.userId,
      cooldownMinutes: 60,
      details: {
        metoda: "Google",
        ip: signupClientIp || "nieznane",
        "2FA": "nieaktywne",
      },
    });
  }

  return {
    appBaseUrl: googleSettings.appBaseUrl,
    redirectTo: state.returnTo,
    requiresTwoFactor: false,
    twoFactorToken: null,
    session: localSession,
  };
};

const buildWelcomeFallbackEmail = (email: string, generatorUrl: string, year: number) => ({
  subject: "Witaj w Kreatorze Grafik AI!",
  html: `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#1a1428;font-family:'Segoe UI',sans-serif;color:#e8e0f0"><div style="max-width:560px;margin:0 auto;padding:40px 20px"><div style="background:linear-gradient(145deg,#2a1f3d,#1e1530);border-radius:16px;padding:40px 32px;border:1px solid rgba(168,85,247,0.2)"><div style="text-align:center;margin-bottom:28px"><div style="font-size:22px;font-weight:700;color:#f0e8ff">Kreator Grafik AI</div></div><h1 style="font-size:24px;font-weight:700;margin:0 0 16px;color:#f0e8ff">Witaj w Kreatorze Grafik AI!</h1><p style="font-size:15px;line-height:1.7;color:#c4b5d6;margin:0 0 16px">Konto ${email} zostalo utworzone i jest gotowe do dzialania.</p><div style="text-align:center"><a href="${generatorUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;margin:8px 0 24px">Przejdz do generatora</a></div></div><div style="text-align:center;font-size:12px;color:#7c6f8e;margin-top:24px">&copy; ${year} Kreator Grafik AI.</div></div></body></html>`,
});

const buildEmailConfirmationFallbackEmail = (email: string, confirmationUrl: string, year: number) => ({
  subject: "Potwierdz email - Kreator Grafik AI",
  html: `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#1a1428;font-family:'Segoe UI',sans-serif;color:#e8e0f0"><div style="max-width:560px;margin:0 auto;padding:40px 20px"><div style="background:linear-gradient(145deg,#2a1f3d,#1e1530);border-radius:16px;padding:40px 32px;border:1px solid rgba(168,85,247,0.2)"><div style="text-align:center;margin-bottom:28px"><div style="font-size:22px;font-weight:700;color:#f0e8ff">Kreator Grafik AI</div></div><h1 style="font-size:24px;font-weight:700;margin:0 0 16px;color:#f0e8ff">Potwierdz adres email</h1><p style="font-size:15px;line-height:1.7;color:#c4b5d6;margin:0 0 16px">Konto ${email} zostalo utworzone. Kliknij przycisk ponizej, aby aktywowac konto i korzystac z generatora.</p><div style="text-align:center"><a href="${confirmationUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;margin:8px 0 24px">Potwierdz email</a></div><p style="font-size:13px;line-height:1.6;color:#a99bbb;margin:0">Link jest wazny przez 24 godziny.</p></div><div style="text-align:center;font-size:12px;color:#7c6f8e;margin-top:24px">&copy; ${year} Kreator Grafik AI.</div></div></body></html>`,
});

const buildResetFallbackEmail = (resetLink: string, year: number) => ({
  subject: "Reset hasla - Kreator Grafik AI",
  html: `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#1a1428;font-family:'Segoe UI',sans-serif;color:#e8e0f0"><div style="max-width:560px;margin:0 auto;padding:40px 20px"><div style="background:linear-gradient(145deg,#2a1f3d,#1e1530);border-radius:16px;padding:40px 32px;border:1px solid rgba(168,85,247,0.2)"><div style="text-align:center;margin-bottom:28px"><div style="font-size:22px;font-weight:700;color:#f0e8ff">Kreator Grafik AI</div></div><h1 style="font-size:24px;font-weight:700;margin:0 0 16px;color:#f0e8ff">Reset hasla</h1><p style="font-size:15px;line-height:1.7;color:#c4b5d6;margin:0 0 16px">Kliknij przycisk ponizej, aby ustawic nowe haslo.</p><div style="text-align:center"><a href="${resetLink}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;margin:8px 0 24px">Ustaw nowe haslo</a></div><p style="font-size:15px;line-height:1.7;color:#c4b5d6;margin:0">Link jest wazny przez 60 minut.</p></div><div style="text-align:center;font-size:12px;color:#7c6f8e;margin-top:24px">&copy; ${year} Kreator Grafik AI.</div></div></body></html>`,
});

const verifyCaptchaTokenForRequest = async (token?: string | null) => {
  if (!token) {
    return { success: false, error: "Brak tokenu captcha." };
  }

  let provider = env.turnstileSecretKey ? "turnstile" : "recaptcha";
  let secret = env.turnstileSecretKey;

  try {
    const settings = await getLocalSettingsMap(["captcha_secret_key", "captcha_provider"]);
    if (settings.captcha_provider) provider = settings.captcha_provider;
    if (settings.captcha_secret_key) secret = settings.captcha_secret_key;
  } catch (error) {
    console.error("VPS captcha settings load error:", error);
  }

  if (provider === "none") {
    return { success: false, error: "Captcha jest wymagana przy rejestracji." };
  }

  if (!secret) {
    return { success: false, error: "Brak konfiguracji captcha na VPS." };
  }

  const verifyUrl = VERIFY_URLS[provider] || VERIFY_URLS.recaptcha;
  const formData = new URLSearchParams();
  formData.set("secret", secret);
  formData.set("response", token);

  const captchaResponse = await fetch(verifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
  const outcome = await captchaResponse.json().catch(() => ({ success: false }));

  return {
    success: Boolean(outcome.success),
    error: outcome.success ? undefined : "Weryfikacja captcha nie powiodla sie.",
  };
};

const sendEmailConfirmationEmail = async (email: string, userId: string) => {
  const token = await issueLocalEmailConfirmationToken(userId);
  if (!token) throw new Error("Nie udalo sie przygotowac tokenu potwierdzenia email.");

  const appUrls = await loadAppUrlSettings();
  const confirmationUrl = `${appUrls.appBaseUrl}/auth/confirm-email?token=${encodeURIComponent(token)}`;
  const fallback = buildEmailConfirmationFallbackEmail(email, confirmationUrl, new Date().getFullYear());

  await sendTransactionalEmail({
    to: email,
    subject: fallback.subject,
    html: fallback.html,
  });
};

const normalizeUser = (user: AuthUserLike | null | undefined) => {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? null,
  };
};

const syncLocalUserMirror = async (
  user:
    | AuthUserLike
    | null
    | undefined
) => {
  if (!user?.id) return;

  await Promise.all([
    upsertLocalAuthUsersRows([
      {
        user_id: user.id,
        email: user.email ?? null,
        email_confirmed_at: user.email_confirmed_at ?? null,
        created_at: user.created_at ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
      },
    ]),
    upsertLocalProfilesRows([
      {
        user_id: user.id,
        email: user.email ?? null,
      },
    ]),
  ]).catch(() => null);
};

const createLocalRegisteredUser = async (
  email: string,
  options: {
    signupClientIp?: string | null;
    emailConfirmedAt?: string | null;
  } = {}
) => {
  if (!hasLocalDatabase()) {
    return null;
  }

  await ensureLocalDatabaseSchema();

  const userId = randomUUID();
  const timestamp = new Date().toISOString();
  const signupIpHash = hashSignupClientIp(options.signupClientIp);
  const client = await getPostgresPool().connect();

  try {
    await client.query("BEGIN");
    if (signupIpHash) {
      const claimResult = await client.query(
        [
          "INSERT INTO signup_bonus_ip_claims (ip_hash, user_id, email, created_at)",
          "VALUES ($1, $2, $3, $4)",
          "ON CONFLICT (ip_hash) DO NOTHING",
        ].join(" "),
        [signupIpHash, userId, email, timestamp]
      );

      if ((claimResult.rowCount ?? 0) === 0) {
        throw new SignupBonusIpAlreadyClaimedError();
      }
    }

    await client.query(
      [
        "INSERT INTO auth_users (user_id, email, email_confirmed_at, created_at, last_sign_in_at, updated_at)",
        "VALUES ($1, $2, $3, $4, $5, $6)",
      ].join(" "),
      [userId, email, options.emailConfirmedAt ?? null, timestamp, null, timestamp]
    );
    await client.query(
      [
        "INSERT INTO profiles (user_id, email, created_at)",
        "VALUES ($1, $2, $3)",
        "ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email",
      ].join(" "),
      [userId, email, timestamp]
    );
    await client.query(
      [
        "INSERT INTO user_credits (user_id, balance, created_at, updated_at)",
        "VALUES ($1, $2, $3, $3)",
        "ON CONFLICT (user_id) DO NOTHING",
      ].join(" "),
      [userId, INITIAL_SIGNUP_CREDITS, timestamp]
    );
    await client.query("COMMIT");

    return {
      userId,
      email,
      createdAt: timestamp,
      emailConfirmedAt: timestamp,
      lastSignInAt: timestamp,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  } finally {
    client.release();
  }
};

const deleteLocalSignupBonusIpClaimByUserId = async (userId: string) => {
  if (!hasLocalDatabase() || !userId) return;

  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("DELETE FROM signup_bonus_ip_claims WHERE user_id = $1", [userId]);
};

const buildAppSession = ({
  session,
  accessToken,
  refreshToken,
  expiresAt,
  expiresIn,
  tokenType,
  user,
}: {
  session?: AuthSessionLike | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  expiresIn?: number | null;
  tokenType?: string | null;
  user?: Pick<AuthUserLike, "id" | "email"> | null;
}) => {
  const normalizedUser = normalizeUser(session?.user ?? user ?? null);
  if (!normalizedUser && !accessToken) return null;

  const resolvedExpiresAt = session?.expires_at ?? expiresAt ?? null;
  const resolvedExpiresIn = session?.expires_in ?? expiresIn ?? null;
  const resolvedAccessToken =
    accessToken ||
    issueLocalAccessToken({
      userId: normalizedUser?.id || "",
      email: normalizedUser?.email ?? null,
      expiresAt: resolvedExpiresAt,
      expiresIn: resolvedExpiresIn,
    });

  return {
    accessToken: resolvedAccessToken,
    refreshToken: session?.refresh_token ?? refreshToken ?? null,
    tokenType: session?.token_type ?? tokenType ?? "bearer",
    expiresAt: resolvedExpiresAt,
    expiresIn: resolvedExpiresIn,
    user: normalizedUser ?? null,
  };
};

const getIssuedLocalAccessExpiry = () => {
  const expiresIn = Math.max(env.jwtAccessExpiresSeconds || 15 * 60, 60);
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  return { expiresAt, expiresIn };
};

const buildLocalSessionForUser = async ({
  userId,
  email,
  refreshToken,
}: {
  userId: string;
  email: string | null;
  refreshToken?: string | null;
}) => {
  const accessExpiry = getIssuedLocalAccessExpiry();
  const localRefresh = refreshToken
    ? {
        refreshToken,
      }
    : await issueLocalRefreshToken(userId);

  return buildAppSession({
    refreshToken: localRefresh?.refreshToken ?? null,
    expiresAt: accessExpiry.expiresAt,
    expiresIn: accessExpiry.expiresIn,
    tokenType: "bearer",
    user: {
      id: userId,
      email,
    },
  });
};

authRouter.post("/auth/captcha/verify", authCaptchaRateLimit, async (request, response) => {
  try {
    const { token } = request.body as { token?: string };
    const outcome = await verifyCaptchaTokenForRequest(token);

    response.status(outcome.success ? 200 : 403).json(outcome);
  } catch (error) {
    console.error("VPS captcha verify error:", error);
    response.status(500).json({ success: false, error: "Nie udalo sie zweryfikowac captcha." });
  }
});

authRouter.post("/auth/email", authEmailRateLimit, async (request, response) => {
  try {
    const { type, email } = request.body as AuthEmailBody;
    if (!email) {
      response.status(400).json({ success: false, error: "Email jest wymagany." });
      return;
    }

    const appUrls = await loadAppUrlSettings();
    const year = new Date().getFullYear();

    if (type === "signup") {
      const tplData = await getLocalEmailTemplateBySlug("welcome", true);

      const templateVars = {
        email,
        appBaseUrl: appUrls.appBaseUrl,
        generatorUrl: appUrls.generatorUrl,
        resetPasswordUrl: appUrls.resetPasswordUrl,
      };
      const fallback = buildWelcomeFallbackEmail(email, appUrls.generatorUrl, year);
      const subject = tplData ? replaceVariables(tplData.subject, templateVars) : fallback.subject;
      const html = tplData ? replaceVariables(tplData.html_content, templateVars) : fallback.html;

      await sendTransactionalEmail({ to: email, subject, html });
      response.json({ success: true });
      return;
    }

    if (type === "reset") {
      await sendResetPasswordEmail(email);
      response.json({ success: true });
      return;
    }

    response.status(400).json({ success: false, error: "Nieznany typ maila." });
  } catch (error) {
    console.error("VPS auth email error:", error);
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Nie udalo sie wyslac maila.",
    });
  }
});

authRouter.get("/auth/confirm-email", async (request, response) => {
  const appUrls = await loadAppUrlSettings();

  try {
    const token = String(request.query.token || "");
    if (!token) {
      response.redirect(`${appUrls.appBaseUrl}/auth?email_confirmed=missing`);
      return;
    }

    const consumedToken = await consumeLocalEmailConfirmationToken(token);
    if (!consumedToken?.user_id) {
      response.redirect(`${appUrls.appBaseUrl}/auth?email_confirmed=invalid`);
      return;
    }

    await confirmLocalUserEmail(consumedToken.user_id);
    response.redirect(`${appUrls.appBaseUrl}/auth?email_confirmed=1`);
  } catch (error) {
    console.error("VPS auth confirm email error:", error);
    response.redirect(`${appUrls.appBaseUrl}/auth?email_confirmed=error`);
  }
});

authRouter.post("/auth/confirm-email", authEmailRateLimit, async (request, response) => {
  try {
    const { token } = request.body as { token?: string };
    if (!token) {
      response.status(400).json({ ok: false, error: "Brak tokenu potwierdzenia email." });
      return;
    }

    const consumedToken = await consumeLocalEmailConfirmationToken(token);
    if (!consumedToken?.user_id) {
      response.status(400).json({ ok: false, error: "Link potwierdzajacy jest nieprawidlowy albo wygasl." });
      return;
    }

    await confirmLocalUserEmail(consumedToken.user_id);
    response.json({ ok: true });
  } catch (error) {
    console.error("VPS auth confirm email API error:", error);
    response.status(500).json({ ok: false, error: "Nie udalo sie potwierdzic emaila." });
  }
});

authRouter.post("/auth/register", authRegisterRateLimit, async (request, response) => {
  try {
    const { email, password, captchaToken } = request.body as AuthRegisterBody;

    if (!email || !password) {
      response.status(400).json({ ok: false, error: "Email i haslo sa wymagane." });
      return;
    }

    const captchaOutcome = await verifyCaptchaTokenForRequest(captchaToken);
    if (!captchaOutcome.success) {
      response.status(403).json({
        ok: false,
        error: captchaOutcome.error || "Weryfikacja captcha nie powiodla sie.",
      });
      return;
    }

    if (!hasLocalDatabase()) {
      response.status(503).json({ ok: false, error: "Lokalna baza uzytkownikow nie jest dostepna." });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingLocalAuthUser = await getLocalAuthUserByEmail(normalizedEmail).catch(() => null);
    if (existingLocalAuthUser?.user_id) {
      response.status(400).json({ ok: false, error: "User already registered" });
      return;
    }

    const localUser = await createLocalRegisteredUser(normalizedEmail, {
      signupClientIp: getRequestClientIp(request),
    });
    if (!localUser?.userId) {
      throw new Error("Lokalna baza uzytkownikow nie jest dostepna.");
    }

    try {
      await upsertLocalPasswordCredential({
        userId: localUser.userId,
        email: normalizedEmail,
        password,
        migratedFrom: "vps-register",
      });
    } catch (error) {
      await Promise.all([
        deleteLocalSignupBonusIpClaimByUserId(localUser.userId).catch(() => null),
        deleteLocalUserMirror(localUser.userId).catch(() => null),
        deleteLocalAuthUser(localUser.userId).catch(() => null),
      ]);
      throw error;
    }

    try {
      await sendEmailConfirmationEmail(normalizedEmail, localUser.userId);
    } catch (error) {
      await Promise.all([
        deleteLocalCredentialArtifactsByUserId(localUser.userId).catch(() => null),
        deleteLocalSignupBonusIpClaimByUserId(localUser.userId).catch(() => null),
        deleteLocalUserMirror(localUser.userId).catch(() => null),
        deleteLocalAuthUser(localUser.userId).catch(() => null),
      ]);
      throw error;
    }

    response.json({
      ok: true,
      user: {
        id: localUser.userId,
        email: normalizedEmail,
      },
      requiresEmailConfirmation: true,
    });
  } catch (error) {
    if (isSignupBonusIpAlreadyClaimedError(error)) {
      response.status(409).json({
        ok: false,
        error:
          "Darmowe kredyty startowe zostaly juz wykorzystane z tego adresu IP. Zaloguj sie na istniejace konto lub skontaktuj sie z pomoca.",
      });
      return;
    }

    console.error("VPS auth register error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie zarejestrowac konta.",
    });
  }
});

authRouter.post("/auth/login", authLoginRateLimit, async (request, response) => {
  try {
    const { email, password, returnTo } = request.body as AuthLoginBody;

    if (!email || !password) {
      response.status(400).json({ ok: false, error: "Email i haslo sa wymagane." });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const localAuthUser = await getLocalAuthUserByEmail(normalizedEmail).catch(() => null);
    if (!localAuthUser?.user_id) {
      response.status(400).json({ ok: false, error: "Nieprawidlowy email lub haslo." });
      return;
    }

    const localCredential = await getLocalCredentialByUserId(localAuthUser.user_id).catch(() => null);
    if (!localCredential) {
      response.status(400).json({
        ok: false,
        error: "To konto wymaga jednorazowego resetu hasla po migracji. Kliknij \"Zapomniales hasla?\".",
      });
      return;
    }

    const verifiedLocalCredential = await verifyLocalPasswordCredential({
      userId: localAuthUser.user_id,
      password,
    }).catch(() => null);

    if (!verifiedLocalCredential) {
      if (await hasLocalUserRole(localAuthUser.user_id, "admin").catch(() => false)) {
        sendAdminSecurityAlertSoon({
          eventKey: `admin-login-password-failed:${localAuthUser.user_id}:${getRequestClientIp(request)}`,
          title: "Nieudane logowanie administratora",
          severity: "critical",
          actorEmail: localAuthUser.email ?? normalizedEmail,
          actorUserId: localAuthUser.user_id,
          request,
          cooldownMinutes: 15,
          details: {
            etap: "haslo",
          },
        });
      }
      response.status(400).json({ ok: false, error: "Nieprawidlowy email lub haslo." });
      return;
    }

    if (!localAuthUser.email_confirmed_at) {
      response.status(403).json({
        ok: false,
        error: "Email not confirmed",
      });
      return;
    }

    const isAdmin = await hasLocalUserRole(localAuthUser.user_id, "admin");
    const requiresTwoFactor = isAdmin && (await isLocalUserTotpEnabled(localAuthUser.user_id));
    if (requiresTwoFactor) {
      response.json({
        ok: true,
        requiresTwoFactor: true,
        twoFactorToken: buildTwoFactorChallengeToken({
          userId: localAuthUser.user_id,
          email: localAuthUser.email ?? normalizedEmail,
          returnTo: normalizeReturnTo(returnTo || "/dashboard"),
        }),
      });
      return;
    }

    await syncLocalUserMirror({
      id: localAuthUser.user_id,
      email: localAuthUser.email ?? normalizedEmail,
      email_confirmed_at: localAuthUser.email_confirmed_at,
      created_at: localAuthUser.created_at,
      last_sign_in_at: new Date().toISOString(),
    });

    const localSession = await buildLocalSessionForUser({
      userId: localAuthUser.user_id,
      email: localAuthUser.email ?? normalizedEmail,
    });

    if (isAdmin) {
      sendAdminSecurityAlertSoon({
        eventKey: `admin-login:${localAuthUser.user_id}:${getRequestClientIp(request)}`,
        title: "Logowanie administratora bez aktywnego 2FA",
        severity: "critical",
        actorEmail: localAuthUser.email ?? normalizedEmail,
        actorUserId: localAuthUser.user_id,
        request,
        cooldownMinutes: 60,
        details: {
          metoda: "email + hasło",
          "2FA": "nieaktywne",
        },
      });
    }

    response.json({
      ok: true,
      session: localSession,
    });
  } catch (error) {
    console.error("VPS auth login error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie zalogowac.",
    });
  }
});

authRouter.post("/auth/2fa/verify", authLoginRateLimit, async (request, response) => {
  try {
    const { challengeToken, code, recoveryCode } = request.body as AuthTwoFactorVerifyBody;
    const useRecoveryCode = Boolean(String(recoveryCode || "").trim());
    if (!challengeToken || (!code && !recoveryCode)) {
      response.status(400).json({ ok: false, error: "Podaj kod 2FA." });
      return;
    }

    const challenge = parseTwoFactorChallengeToken(challengeToken);
    const localAuthUser = await getLocalAuthUser(challenge.userId).catch(() => null);
    if (!localAuthUser?.user_id || !localAuthUser.email_confirmed_at) {
      response.status(401).json({ ok: false, error: "Nieprawidlowa sesja 2FA." });
      return;
    }

    const isAdmin = await hasLocalUserRole(localAuthUser.user_id, "admin");
    const twoFactorEnabled = await isLocalUserTotpEnabled(localAuthUser.user_id);
    if (!isAdmin || !twoFactorEnabled) {
      response.status(403).json({ ok: false, error: "2FA nie jest aktywne dla tego konta." });
      return;
    }

    const validCode = useRecoveryCode
      ? await consumeLocalUserRecoveryCode(localAuthUser.user_id, String(recoveryCode || ""))
      : await verifyLocalUserTotp(localAuthUser.user_id, String(code || ""), { markUsed: true });
    if (!validCode) {
      sendAdminSecurityAlertSoon({
        eventKey: `admin-2fa-failed:${useRecoveryCode ? "recovery" : "totp"}:${localAuthUser.user_id}:${getRequestClientIp(request)}`,
        title: useRecoveryCode ? "Nieudana próba kodu odzyskiwania 2FA" : "Nieudana próba kodu 2FA administratora",
        severity: "critical",
        actorEmail: localAuthUser.email ?? challenge.email,
        actorUserId: localAuthUser.user_id,
        request,
        cooldownMinutes: 15,
      });
      response.status(400).json({ ok: false, error: "Nieprawidlowy kod 2FA." });
      return;
    }

    await syncLocalUserMirror({
      id: localAuthUser.user_id,
      email: localAuthUser.email ?? challenge.email,
      email_confirmed_at: localAuthUser.email_confirmed_at,
      created_at: localAuthUser.created_at,
      last_sign_in_at: new Date().toISOString(),
    });

    const localSession = await buildLocalSessionForUser({
      userId: localAuthUser.user_id,
      email: localAuthUser.email ?? challenge.email,
    });

    sendAdminSecurityAlertSoon({
      eventKey: `admin-login-2fa:${localAuthUser.user_id}:${getRequestClientIp(request)}`,
      title: "Logowanie administratora z 2FA",
      severity: "warning",
      actorEmail: localAuthUser.email ?? challenge.email,
      actorUserId: localAuthUser.user_id,
      request,
      cooldownMinutes: 60,
      details: {
        metoda: useRecoveryCode ? "kod odzyskiwania 2FA" : "kod 2FA",
        przekierowanie: challenge.returnTo,
      },
    });

    response.json({
      ok: true,
      redirectTo: challenge.returnTo,
      session: localSession,
    });
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie zweryfikowac 2FA.",
    });
  }
});

authRouter.post("/auth/logout", async (request, response) => {
  try {
    const { refreshToken } = request.body as AuthLogoutBody;

    if (!refreshToken) {
      response.json({ ok: true });
      return;
    }

    await revokeLocalRefreshToken(refreshToken).catch(() => false);
    response.json({ ok: true });
  } catch (error) {
    console.error("VPS auth logout error:", error);
    response.json({ ok: true });
  }
});

authRouter.post("/auth/refresh", authRefreshRateLimit, async (request, response) => {
  try {
    const { refreshToken } = request.body as AuthRefreshBody;

    if (!refreshToken) {
      response.status(400).json({ ok: false, error: "Brak refresh tokenu." });
      return;
    }

    const localRefresh = await rotateLocalRefreshToken(refreshToken).catch(() => null);
    if (localRefresh?.reuseDetected && localRefresh.userId) {
      const localAuthUser = await getLocalAuthUser(localRefresh.userId).catch(() => null);
      sendAdminSecurityAlertSoon({
        eventKey: `refresh-token-reuse:${localRefresh.userId}:${getRequestClientIp(request)}`,
        title: "Wykryto ponowne użycie starego refresh tokenu",
        severity: "critical",
        actorEmail: localAuthUser?.email ?? null,
        actorUserId: localRefresh.userId,
        request,
        cooldownMinutes: 15,
        details: {
          akcja: "Unieważniono aktywne refresh tokeny użytkownika",
          powod: "Stary refresh token został użyty po rotacji",
        },
      });
      response.status(401).json({ ok: false, error: "Sesja zostala uniewazniona. Zaloguj sie ponownie." });
      return;
    }

    if (localRefresh?.userId && localRefresh.refreshToken) {
      const localAuthUser = await getLocalAuthUser(localRefresh.userId).catch(() => null);
      if (!localAuthUser?.email_confirmed_at) {
        response.status(403).json({ ok: false, error: "Email not confirmed" });
        return;
      }

      const localSession = await buildLocalSessionForUser({
        userId: localRefresh.userId,
        email: localAuthUser?.email ?? null,
        refreshToken: localRefresh.refreshToken,
      });

      response.json({
        ok: true,
        session: localSession,
      });
      return;
    }

    response.status(401).json({ ok: false, error: "Nie udalo sie odswiezyc sesji." });
  } catch (error) {
    console.error("VPS auth refresh error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie odswiezyc sesji.",
    });
  }
});

authRouter.post("/auth/session/from-token", async (request, response) => {
  try {
    const { accessToken, refreshToken, expiresAt, expiresIn, tokenType } =
      request.body as AuthSessionFromTokenBody;

    if (!accessToken) {
      response.status(400).json({ ok: false, error: "Brak access tokenu." });
      return;
    }

    const localPayload = verifyLocalAccessToken(accessToken);
    if (localPayload) {
      const localUser = await getLocalAuthUser(localPayload.sub).catch(() => null);
      if (!localUser?.user_id) {
        response.status(401).json({ ok: false, error: "Nie udalo sie odczytac sesji." });
        return;
      }

      if (!localUser.email_confirmed_at) {
        response.status(403).json({ ok: false, error: "Email not confirmed" });
        return;
      }

      response.json({
        ok: true,
        session: buildAppSession({
          accessToken,
          refreshToken,
          expiresAt: localPayload.exp,
          expiresIn: expiresIn ?? Math.max(localPayload.exp - Math.floor(Date.now() / 1000), 0),
          tokenType,
          user: {
            id: localUser.user_id,
            email: localUser.email ?? null,
          },
        }),
      });
      return;
    }

    response.status(401).json({ ok: false, error: "Nie udalo sie odczytac sesji." });
  } catch (error) {
    console.error("VPS auth session-from-token error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie odczytac sesji.",
    });
  }
});

authRouter.get("/auth/google", async (_request, response) => {
  try {
    const returnTo = normalizeReturnTo(String(_request.query.returnTo || "/"));
    const googleSettings = await loadGoogleOAuthSettings();

    if (!googleSettings.clientId || !googleSettings.clientSecret) {
      response.redirect(buildAuthErrorRedirectUrl(googleSettings.appBaseUrl, "Google OAuth nie jest jeszcze skonfigurowany."));
      return;
    }

    const state = buildGoogleOAuthState(returnTo);
    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set("client_id", googleSettings.clientId);
    authUrl.searchParams.set("redirect_uri", googleSettings.callbackUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("state", state);

    response.redirect(authUrl.toString());
  } catch (error) {
    console.error("VPS auth google start error:", error);
    const { appBaseUrl } = await loadAppUrlSettings();
    response.redirect(
      buildAuthErrorRedirectUrl(
        appBaseUrl,
        error instanceof Error ? error.message : "Nie udalo sie rozpoczac logowania przez Google."
      )
    );
  }
});

authRouter.post("/auth/google/callback", async (request, response) => {
  try {
    const { code, state } = request.body as AuthGoogleCallbackBody;

    if (!code) {
      response.status(400).json({ ok: false, error: "Brak kodu autoryzacji Google." });
      return;
    }

    const result = await exchangeGoogleCodeForSession(code, state, getRequestClientIp(request));
    if (result.requiresTwoFactor) {
      response.json({
        ok: true,
        redirectTo: result.redirectTo,
        requiresTwoFactor: true,
        twoFactorToken: result.twoFactorToken,
      });
      return;
    }

    response.json({
      ok: true,
      redirectTo: result.redirectTo,
      session: result.session,
    });
  } catch (error) {
    console.error("VPS auth google callback exchange error:", error);
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie dokonczyc logowania Google.",
    });
  }
});

authRouter.get("/auth/google/callback", async (request, response) => {
  try {
    const code = String(request.query.code || "");
    const state = String(request.query.state || "");
    const authError = String(request.query.error || "");
    const authErrorDescription = String(request.query.error_description || "");
    const { appBaseUrl } = await loadAppUrlSettings();

    if (authError) {
      response.redirect(
        buildAuthErrorRedirectUrl(appBaseUrl, authErrorDescription || authError || "Logowanie Google zostalo anulowane.")
      );
      return;
    }

    if (!code) {
      response.redirect(buildAuthErrorRedirectUrl(appBaseUrl, "Brak kodu autoryzacji Google."));
      return;
    }

    const result = await exchangeGoogleCodeForSession(code, state, getRequestClientIp(request));
    if (result.requiresTwoFactor) {
      const target = new URL("/auth", `${result.appBaseUrl}/`);
      target.searchParams.set("two_factor_token", result.twoFactorToken || "");
      target.searchParams.set("returnTo", result.redirectTo);
      response.redirect(target.toString());
      return;
    }

    if (!result.session) {
      throw new Error("Nie udalo sie przygotowac sesji po logowaniu Google.");
    }

    response.redirect(
      buildSessionRedirectUrl(result.appBaseUrl, result.redirectTo, {
        accessToken: result.session.accessToken,
        refreshToken: result.session.refreshToken,
        expiresAt: result.session.expiresAt,
        expiresIn: result.session.expiresIn,
        tokenType: result.session.tokenType,
      })
    );
  } catch (error) {
    console.error("VPS auth google callback redirect error:", error);
    const { appBaseUrl } = await loadAppUrlSettings();
    response.redirect(
      buildAuthErrorRedirectUrl(
        appBaseUrl,
        error instanceof Error ? error.message : "Nie udalo sie dokonczyc logowania Google."
      )
    );
  }
});
authRouter.post("/auth/password-reset/request", authPasswordResetRequestRateLimit, async (request, response) => {
  try {
    const { email } = request.body as AuthEmailBody;

    if (!email) {
      response.status(400).json({ ok: false, error: "Email jest wymagany." });
      return;
    }

    await sendResetPasswordEmail(email);
    response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udalo sie wyslac linku resetujacego.";
    if (message === "user_not_found") {
      response.status(404).json({ ok: false, error: "user_not_found" });
      return;
    }

    console.error("VPS auth password reset request error:", error);
    response.status(500).json({ ok: false, error: message });
  }
});

authRouter.post("/auth/password-reset/verify", authPasswordResetVerifyRateLimit, async (request, response) => {
  try {
    const { tokenHash } = request.body as AuthPasswordResetVerifyBody;

    if (!tokenHash) {
      response.status(400).json({ ok: false, error: "Brak tokenu resetujacego." });
      return;
    }

    const localResetToken = await getLocalPasswordResetToken(tokenHash).catch(() => null);
    if (localResetToken) {
      response.json({
        ok: true,
        accessToken: tokenHash,
      });
      return;
    }

    response.status(401).json({
      ok: false,
      error: "Link resetujacy jest nieprawidlowy lub wygasl.",
    });
  } catch (error) {
    console.error("VPS auth password reset verify error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie zweryfikowac linku resetujacego.",
    });
  }
});

authRouter.post("/auth/password-reset/confirm", authPasswordResetConfirmRateLimit, async (request, response) => {
  try {
    const { accessToken, password } = request.body as AuthPasswordResetConfirmBody;

    if (!accessToken || !password) {
      response.status(400).json({ ok: false, error: "Brak tokenu lub hasla." });
      return;
    }

    const consumedLocalResetToken = await consumeLocalPasswordResetToken(accessToken).catch(() => null);
    if (consumedLocalResetToken?.user_id) {
      const localAuthUser = await getLocalAuthUser(consumedLocalResetToken.user_id).catch(() => null);
      const userEmail = localAuthUser?.email ?? null;

      await upsertLocalPasswordCredential({
        userId: consumedLocalResetToken.user_id,
        email: userEmail,
        password,
        migratedFrom: "password-reset-local",
      }).catch(() => null);

      if (localAuthUser) {
        await syncLocalUserMirror({
          id: localAuthUser.user_id,
          email: localAuthUser.email,
          email_confirmed_at: localAuthUser.email_confirmed_at,
          created_at: localAuthUser.created_at,
          last_sign_in_at: localAuthUser.last_sign_in_at,
        });
      }

      response.json({ ok: true });
      return;
    }

    response.status(401).json({ ok: false, error: "Link resetujacy jest nieprawidlowy lub wygasl." });
  } catch (error) {
    console.error("VPS auth password reset confirm error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie zmienic hasla.",
    });
  }
});
authRouter.post("/auth/email/welcome", authEmailRateLimit, async (request, response) => {
  try {
    const body = (request.body || {}) as { email?: string };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) {
      response.status(400).json({ ok: false, error: "Email jest wymagany." });
      return;
    }

    const appUrls = await loadAppUrlSettings();
    const year = new Date().getFullYear();
    const tplData = await getLocalEmailTemplateBySlug("welcome", true);
    const templateVars = {
      email,
      appBaseUrl: appUrls.appBaseUrl,
      generatorUrl: appUrls.generatorUrl,
      resetPasswordUrl: appUrls.resetPasswordUrl,
    };
    const fallback = buildWelcomeFallbackEmail(email, appUrls.generatorUrl, year);
    const subject = tplData ? replaceVariables(tplData.subject, templateVars) : fallback.subject;
    const html = tplData ? replaceVariables(tplData.html_content, templateVars) : fallback.html;

    await sendTransactionalEmail({ to: email, subject, html });
    response.json({ ok: true, success: true });
  } catch (error) {
    console.error("VPS auth welcome email error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie wyslac maila powitalnego.",
    });
  }
});
