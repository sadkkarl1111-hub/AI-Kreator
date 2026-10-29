import crypto, { X509Certificate, type KeyObject } from "node:crypto";
import { env } from "../config/env.js";

type TpayTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  issued_at?: number;
  error?: string;
  message?: string;
};

type TpayTransactionRequest = {
  amount: number;
  description: string;
  hiddenDescription: string;
  callbacks: {
    notification: {
      url: string;
    };
    payerUrls: {
      success: string;
      error: string;
    };
  };
  payer?: {
    email?: string;
    name?: string;
    ip?: string;
  };
};

type TpayTransactionResponse = {
  result?: string;
  requestId?: string;
  transactionId?: string;
  transactionPaymentUrl?: string;
  status?: string;
  title?: string;
  amount?: number;
  currency?: string;
  hiddenDescription?: string;
  payments?: {
    status?: string;
    amountPaid?: number;
    date?: {
      realization?: string | null;
    };
  };
};

type TpayWebhookHeader = {
  x5u?: string;
  alg?: string;
};

type TpayWebhookPayload = {
  id?: string;
  tr_id?: string;
  tr_date?: string;
  tr_crc?: string;
  tr_amount?: string;
  tr_paid?: string;
  tr_desc?: string;
  tr_status?: string;
  tr_error?: string;
  tr_email?: string;
  md5sum?: string;
  test_mode?: string;
};

type TpayCreatePaymentInput = {
  notifyUrl: string;
  continueUrl: string;
  customerIp: string;
  description: string;
  totalAmount: string;
  externalSessionId: string;
  buyer?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
};

let tpayTokenCache:
  | {
      value: string;
      expiresAt: number;
    }
  | null = null;

let tpayRootCertificateCache:
  | {
      certificate: X509Certificate;
      expiresAt: number;
    }
  | null = null;

const tpaySigningCertificateCache = new Map<
  string,
  {
    certificate: X509Certificate;
    expiresAt: number;
  }
>();

const TPAY_JWS_SIGNING_CERTIFICATE_URL = "https://secure.tpay.com/x509/notifications-jws.pem";
const TPAY_JWS_ROOT_URL = "https://secure.tpay.com/x509/tpay-jws-root.pem";
const CERT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CERT_FETCH_TIMEOUT_MS = 5_000;
const MAX_CERTIFICATE_BYTES = 32 * 1024;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const appendQueryParam = (targetUrl: string, key: string, value: string) => {
  const separator = targetUrl.includes("?") ? "&" : "?";
  return `${targetUrl}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
};

const toTpayAmount = (groszeValue: string) => {
  const amountInGrosze = Number(groszeValue);
  if (!Number.isFinite(amountInGrosze) || amountInGrosze <= 0) {
    throw new Error("Nieprawidlowa kwota platnosci Tpay.");
  }

  return Number((amountInGrosze / 100).toFixed(2));
};

const toGroszeAmount = (value: string | number | null | undefined) => {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.round(numericValue * 100);
};

const normalizeBuyerName = (buyer: TpayCreatePaymentInput["buyer"]) => {
  const fullName = [buyer?.firstName, buyer?.lastName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || undefined;
};

const normalizeTpayPaymentStatus = (value: string | null | undefined) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "PENDING";
  if (normalized === "true" || normalized === "correct" || normalized === "paid" || normalized === "success") {
    return "COMPLETED";
  }
  if (normalized === "chargeback") {
    return "CHARGEBACK";
  }
  if (normalized === "pending") {
    return "PENDING";
  }
  if (normalized === "declined") {
    return "DECLINED";
  }
  if (normalized === "canceled" || normalized === "cancelled" || normalized === "cancel") {
    return "CANCELED";
  }
  if (normalized === "error") {
    return "ERROR";
  }
  return normalized.toUpperCase();
};

const base64UrlEncode = (value: Buffer | string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
};

const getTpayBaseUrl = () => trimTrailingSlash(String(env.tpayApiBase || "https://api.tpay.com").trim());

const assertTpayConfig = () => {
  if (!env.tpayClientId || !env.tpayClientSecret) {
    throw new Error("Brak konfiguracji Tpay (TPAY_CLIENT_ID, TPAY_CLIENT_SECRET).");
  }
  if (!env.tpayMerchantId || !env.tpaySecurityCode) {
    throw new Error("Brak konfiguracji webhooka Tpay (TPAY_MERCHANT_ID, TPAY_SECURITY_CODE).");
  }
};

export const validateTpaySigningCertificateUrl = (value: string) => {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Nieprawidlowy adres certyfikatu webhooka Tpay.");
  }

  const expected = new URL(TPAY_JWS_SIGNING_CERTIFICATE_URL);
  if (
    parsed.protocol !== expected.protocol ||
    parsed.hostname !== expected.hostname ||
    parsed.port !== expected.port ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== expected.pathname ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Nieprawidlowy adres certyfikatu webhooka Tpay.");
  }

  return expected.href;
};

const readLimitedCertificateBody = async (response: Response) => {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CERTIFICATE_BYTES) {
    throw new Error("Certyfikat Tpay jest za duzy.");
  }

  if (!response.body) {
    throw new Error("Tpay zwrocilo pusta odpowiedz certyfikatu.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_CERTIFICATE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Certyfikat Tpay jest za duzy.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
};

const fetchPemCertificate = async (url: string) => {
  let response: Response;

  try {
    response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(CERT_FETCH_TIMEOUT_MS),
      headers: {
        Accept: "application/x-pem-file,text/plain,*/*",
      },
    });
  } catch {
    throw new Error("Nie udalo sie bezpiecznie pobrac certyfikatu Tpay.");
  }

  if (!response.ok) {
    throw new Error(`Tpay zwrocilo blad pobierania certyfikatu (${response.status}).`);
  }

  const pem = await readLimitedCertificateBody(response);
  if (!pem.trim()) {
    throw new Error("Tpay zwrocilo pusty certyfikat.");
  }

  return pem;
};

const getTpayRootCertificate = async () => {
  if (tpayRootCertificateCache && tpayRootCertificateCache.expiresAt > Date.now()) {
    return tpayRootCertificateCache.certificate;
  }

  const pem = await fetchPemCertificate(TPAY_JWS_ROOT_URL);
  const certificate = new X509Certificate(pem);
  tpayRootCertificateCache = {
    certificate,
    expiresAt: Date.now() + CERT_CACHE_TTL_MS,
  };

  return certificate;
};

const getTpaySigningCertificate = async (x5u: string) => {
  const certificateUrl = validateTpaySigningCertificateUrl(x5u);
  const cached = tpaySigningCertificateCache.get(certificateUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.certificate;
  }

  const [pem, rootCertificate] = await Promise.all([
    fetchPemCertificate(certificateUrl),
    getTpayRootCertificate(),
  ]);
  const certificate = new X509Certificate(pem);

  if (!certificate.checkIssued(rootCertificate) || !certificate.verify(rootCertificate.publicKey as KeyObject)) {
    throw new Error("Certyfikat webhooka Tpay nie jest podpisany przez zaufane CA.");
  }

  tpaySigningCertificateCache.set(certificateUrl, {
    certificate,
    expiresAt: Date.now() + CERT_CACHE_TTL_MS,
  });

  return certificate;
};

const requestTpayToken = async () => {
  assertTpayConfig();

  const body = new URLSearchParams({
    client_id: env.tpayClientId,
    client_secret: env.tpayClientSecret,
  });

  const response = await fetch(`${getTpayBaseUrl()}/oauth/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const payload = (await response.json().catch(() => null)) as TpayTokenResponse | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.message || payload?.error || `Tpay auth error ${response.status}.`);
  }

  const expiresIn = Number(payload.expires_in || 7200);
  tpayTokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000 - 30_000,
  };

  return payload.access_token;
};

const getTpayAccessToken = async (forceRefresh = false) => {
  if (!forceRefresh && tpayTokenCache && tpayTokenCache.expiresAt > Date.now()) {
    return tpayTokenCache.value;
  }

  return requestTpayToken();
};

const tpayRequest = async <T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<T> => {
  const doRequest = async (accessToken: string) => {
    return fetch(`${getTpayBaseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(options.body != null ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body != null ? JSON.stringify(options.body) : undefined,
    });
  };

  let accessToken = await getTpayAccessToken(false);
  let response = await doRequest(accessToken);

  if (response.status === 401) {
    accessToken = await getTpayAccessToken(true);
    response = await doRequest(accessToken);
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const errorMessage =
      String(payload?.message || payload?.error || payload?.result || "").trim() || `Tpay API error ${response.status}.`;
    throw new Error(errorMessage);
  }

  return (payload || {}) as T;
};

export const testTpayConnection = async () => {
  assertTpayConfig();
  await getTpayAccessToken(false);

  return {
    merchantId: env.tpayMerchantId,
    baseUrl: getTpayBaseUrl(),
  };
};

export const createTpayTransaction = async (input: TpayCreatePaymentInput) => {
  assertTpayConfig();

  const payer: TpayTransactionRequest["payer"] = {
    email: String(input.buyer?.email || "").trim() || undefined,
    name: normalizeBuyerName(input.buyer),
    ip: String(input.customerIp || "").trim() || undefined,
  };

  const payload: TpayTransactionRequest = {
    amount: toTpayAmount(input.totalAmount),
    description: input.description,
    hiddenDescription: input.externalSessionId,
    callbacks: {
      notification: {
        url: input.notifyUrl,
      },
      payerUrls: {
        success: input.continueUrl,
        error: appendQueryParam(input.continueUrl, "payment_error", "1"),
      },
    },
    payer: Object.values(payer).some(Boolean) ? payer : undefined,
  };

  const response = await tpayRequest<TpayTransactionResponse>("/transactions", {
    method: "POST",
    body: payload,
  });

  if (!response.transactionId) {
    throw new Error("Tpay nie zwrocilo transactionId.");
  }

  if (!response.transactionPaymentUrl) {
    throw new Error("Tpay nie zwrocilo adresu platnosci.");
  }

  return {
    transactionId: response.transactionId,
    redirectUrl: response.transactionPaymentUrl,
    status: normalizeTpayPaymentStatus(response.payments?.status || response.status),
  };
};

export const getTpayTransactionStatus = async (transactionId: string) => {
  assertTpayConfig();

  const response = await tpayRequest<TpayTransactionResponse>(`/transactions/${encodeURIComponent(transactionId)}`);
  const paymentStatus = normalizeTpayPaymentStatus(response.payments?.status || response.status);
  const paidAmount = response.payments?.amountPaid ?? response.amount ?? null;

  return {
    transactionId: response.transactionId || transactionId,
    paymentStatus,
    totalAmount: toGroszeAmount(paidAmount),
    currencyCode: response.currency || "PLN",
    hiddenDescription: response.hiddenDescription || null,
  };
};

const verifyTpayWebhookSignature = async (rawBody: Buffer, jwsSignature: string) => {
  const parts = String(jwsSignature || "").split(".");
  const headerPart = parts[0];
  const payloadPart = parts[1];
  const signaturePart = parts[2];

  if (parts.length !== 3 || !headerPart || payloadPart !== "" || !signaturePart) {
    throw new Error("Nieprawidlowy naglowek X-JWS-Signature.");
  }

  const decodedHeader = JSON.parse(base64UrlDecode(headerPart).toString("utf8")) as TpayWebhookHeader;
  const algorithm = String(decodedHeader.alg || "").trim().toUpperCase();
  const x5u = String(decodedHeader.x5u || "").trim();

  if (algorithm !== "RS256") {
    throw new Error(`Nieobslugiwany algorytm podpisu Tpay: ${algorithm}`);
  }

  if (!x5u) {
    throw new Error("Brak x5u w podpisie webhooka Tpay.");
  }

  const certificate = await getTpaySigningCertificate(x5u);
  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(`${headerPart}.${base64UrlEncode(rawBody)}`);
  verify.end();

  const valid = verify.verify(certificate.publicKey as KeyObject, base64UrlDecode(signaturePart));
  if (!valid) {
    throw new Error("Nieprawidlowy podpis JWS webhooka Tpay.");
  }
};

const verifyTpayWebhookChecksum = (payload: TpayWebhookPayload) => {
  const merchantId = String(env.tpayMerchantId || "").trim();
  const securityCode = String(env.tpaySecurityCode || "").trim();
  const receivedMerchantId = String(payload.id || "").trim();
  const receivedChecksum = String(payload.md5sum || "").trim().toLowerCase();
  const transactionTitle = String(payload.tr_id || "").trim();
  const transactionAmount = String(payload.tr_amount || "").trim();
  const hiddenDescription = String(payload.tr_crc || "").trim();

  if (!merchantId || !securityCode) {
    throw new Error("Brak konfiguracji webhooka Tpay (TPAY_MERCHANT_ID, TPAY_SECURITY_CODE).");
  }
  if (!receivedMerchantId || receivedMerchantId !== merchantId) {
    throw new Error("Webhook Tpay ma nieprawidlowy identyfikator sprzedawcy.");
  }
  if (!receivedChecksum) {
    throw new Error("Brak md5sum w webhooku Tpay.");
  }

  const expectedChecksum = crypto
    .createHash("md5")
    .update(`${receivedMerchantId}${transactionTitle}${transactionAmount}${hiddenDescription}${securityCode}`, "utf8")
    .digest("hex")
    .toLowerCase();

  const expectedBuffer = Buffer.from(expectedChecksum, "hex");
  const receivedBuffer = Buffer.from(receivedChecksum, "hex");

  if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new Error("Webhook Tpay ma nieprawidlowy checksum.");
  }
};

export const parseTpayWebhook = async (rawBody: Buffer, jwsSignature: string | undefined) => {
  assertTpayConfig();

  if (!jwsSignature) {
    throw new Error("Brak naglowka X-JWS-Signature.");
  }

  await verifyTpayWebhookSignature(rawBody, jwsSignature);

  const payload = Object.fromEntries(new URLSearchParams(rawBody.toString("utf8")).entries()) as TpayWebhookPayload;
  verifyTpayWebhookChecksum(payload);

  const externalSessionId = String(payload.tr_crc || "").trim();
  if (!externalSessionId) {
    throw new Error("Brak hiddenDescription (tr_crc) w webhooku Tpay.");
  }

  return {
    externalSessionId,
    externalPaymentId: null as string | null,
    providerReferenceId: String(payload.tr_id || "").trim() || null,
    paymentStatus: normalizeTpayPaymentStatus(payload.tr_status),
    paidAmount: toGroszeAmount(payload.tr_paid),
    payerEmail: String(payload.tr_email || "").trim() || null,
  };
};
