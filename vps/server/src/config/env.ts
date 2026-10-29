import "dotenv/config";

const numberFromEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const durationFromEnv = (value: string | undefined, fallbackSeconds: number) => {
  const trimmed = value?.trim();
  if (!trimmed) return fallbackSeconds;

  const directNumber = Number(trimmed);
  if (Number.isFinite(directNumber) && directNumber > 0) {
    return Math.floor(directNumber);
  }

  const match = trimmed.match(/^(\d+)\s*([smhd])$/i);
  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return fallbackSeconds;

  const unitMultiplier: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return amount * (unitMultiplier[unit] || 1);
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: numberFromEnv(process.env.PORT, 3000),
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  apiUrl: process.env.API_URL ?? "http://localhost:3000",
  adminUrl: process.env.ADMIN_URL ?? "http://localhost:5173/admin",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "change_me_access_secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "change_me_refresh_secret",
  jwtAccessExpiresSeconds: durationFromEnv(process.env.JWT_ACCESS_EXPIRES, 15 * 60),
  jwtRefreshExpiresSeconds: durationFromEnv(process.env.JWT_REFRESH_EXPIRES, 30 * 24 * 60 * 60),
  passwordResetTokenExpiresMinutes: numberFromEnv(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES, 60),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:3000/auth/google/callback",
  emailProvider: process.env.EMAIL_PROVIDER ?? "resend",
  emailFrom: process.env.EMAIL_FROM ?? "Kreator Grafik AI <noreply@localhost>",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailWebhookUrl: process.env.EMAIL_WEBHOOK_URL ?? "",
  emailWebhookToken: process.env.EMAIL_WEBHOOK_TOKEN ?? "",
  adminAlertEmails: process.env.ADMIN_ALERT_EMAILS ?? "",
  paymentProvider: process.env.PAYMENT_PROVIDER ?? "payu",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  payuPosId: process.env.PAYU_POS_ID ?? "",
  payuClientId: process.env.PAYU_CLIENT_ID ?? "",
  payuClientSecret: process.env.PAYU_CLIENT_SECRET ?? "",
  payuSecondKey: process.env.PAYU_SECOND_KEY ?? "",
  payuEnvironment: process.env.PAYU_ENVIRONMENT ?? "production",
  payuApiBase: process.env.PAYU_API_BASE ?? "",
  tpayClientId: process.env.TPAY_CLIENT_ID ?? "",
  tpayClientSecret: process.env.TPAY_CLIENT_SECRET ?? "",
  tpayMerchantId: process.env.TPAY_MERCHANT_ID ?? "",
  tpaySecurityCode: process.env.TPAY_SECURITY_CODE ?? "",
  tpayApiBase: process.env.TPAY_API_BASE ?? "https://api.tpay.com",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  ksefApiToken: process.env.KSEF_API_TOKEN ?? "",
  ksefNip: process.env.KSEF_NIP ?? "",
  ksefEnvironment: process.env.KSEF_ENVIRONMENT ?? process.env.KSEF_ENV ?? "demo",
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? "",
  dailyCreditSpendLimit: numberFromEnv(process.env.DAILY_CREDIT_SPEND_LIMIT, 500),
  freeConcurrentGenerationLimit: numberFromEnv(process.env.FREE_CONCURRENT_GENERATION_LIMIT, 2),
  paidConcurrentGenerationLimit: numberFromEnv(process.env.PAID_CONCURRENT_GENERATION_LIMIT, 5),
  generationJobTtlSeconds: durationFromEnv(process.env.GENERATION_JOB_TTL, 30 * 60),
  storageDriver:
    process.env.STORAGE_DRIVER ??
    (process.env.S3_ENDPOINT &&
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
      ? "s3"
      : "local"),
  uploadDir: process.env.UPLOAD_DIR ?? "/app/storage",
  publicFilesUrl: process.env.PUBLIC_FILES_URL ?? `${process.env.API_URL ?? "http://localhost:3000"}/files`,
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "auto",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  cronSecret: process.env.CRON_SECRET ?? "",
};

const isMissingOrDefaultSecret = (value: string | undefined, defaultMarker = "change_me") => {
  const normalized = String(value || "").trim();
  return !normalized || normalized.toLowerCase().includes(defaultMarker);
};

export const validateProductionEnv = () => {
  if (env.nodeEnv !== "production") return;

  const missing: string[] = [];
  const weak: string[] = [];

  if (!env.databaseUrl) missing.push("DATABASE_URL");
  if (isMissingOrDefaultSecret(env.jwtAccessSecret)) missing.push("JWT_ACCESS_SECRET");
  if (isMissingOrDefaultSecret(env.jwtRefreshSecret)) missing.push("JWT_REFRESH_SECRET");

  if (env.jwtAccessSecret && env.jwtAccessSecret.length < 32) weak.push("JWT_ACCESS_SECRET");
  if (env.jwtRefreshSecret && env.jwtRefreshSecret.length < 32) weak.push("JWT_REFRESH_SECRET");

  if (!env.appUrl.startsWith("https://")) weak.push("APP_URL should use https");
  if (!env.apiUrl.startsWith("https://")) weak.push("API_URL should use https");

  if (missing.length || weak.length) {
    const parts = [
      missing.length ? `missing/default: ${missing.join(", ")}` : "",
      weak.length ? `weak/misconfigured: ${weak.join(", ")}` : "",
    ].filter(Boolean);

    throw new Error(`Production environment validation failed (${parts.join("; ")}).`);
  }
};
