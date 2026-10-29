import crypto from "node:crypto";
import { env } from "../config/env.js";

type PayuTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  grant_type?: string;
  error?: string;
  error_description?: string;
};

type PayuStatus = {
  statusCode?: string;
  code?: string;
  codeLiteral?: string;
  statusDesc?: string;
};

type PayuOrderResponse = {
  status?: PayuStatus;
  redirectUri?: string;
  orderId?: string;
  extOrderId?: string;
};

type PayuOrderDetailsResponse = {
  status?: PayuStatus;
  orders?: Array<{
    orderId?: string;
    extOrderId?: string;
    status?: string;
    totalAmount?: string;
    currencyCode?: string;
  }>;
};

type PayuOrderRequest = {
  notifyUrl?: string;
  continueUrl: string;
  customerIp: string;
  merchantPosId: string;
  description: string;
  currencyCode: string;
  totalAmount: string;
  extOrderId: string;
  buyer?: {
    email?: string;
    language?: string;
    firstName?: string;
    lastName?: string;
  };
  products: Array<{
    name: string;
    unitPrice: string;
    quantity: string;
  }>;
};

let accessTokenCache:
  | {
      value: string;
      expiresAt: number;
    }
  | null = null;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getPayuBaseUrl = () => {
  const explicitBase = String(env.payuApiBase || "").trim();
  if (explicitBase) return trimTrailingSlash(explicitBase);

  const normalizedEnvironment = String(env.payuEnvironment || "production").toLowerCase();
  if (normalizedEnvironment === "sandbox" || normalizedEnvironment === "test") {
    return "https://secure.snd.payu.com";
  }

  return "https://secure.payu.com";
};

const assertPayuCredentials = () => {
  if (!env.payuPosId || !env.payuClientId || !env.payuClientSecret) {
    throw new Error("Brak konfiguracji PayU (PAYU_POS_ID, PAYU_CLIENT_ID, PAYU_CLIENT_SECRET).");
  }
};

const getAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

const requestPayuToken = async () => {
  assertPayuCredentials();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.payuClientId,
    client_secret: env.payuClientSecret,
  });

  const response = await fetch(`${getPayuBaseUrl()}/pl/standard/user/oauth/authorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const payload = (await response.json().catch(() => null)) as PayuTokenResponse | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || `PayU auth error ${response.status}.`);
  }

  const expiresIn = Number(payload.expires_in || 300);
  const expiryBufferMs = 30_000;
  accessTokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000 - expiryBufferMs,
  };

  return payload.access_token;
};

const getPayuAccessToken = async (forceRefresh = false) => {
  if (!forceRefresh && accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.value;
  }

  return requestPayuToken();
};

export const testPayuConnection = async () => {
  await getPayuAccessToken(false);
  return {
    posId: env.payuPosId,
    baseUrl: getPayuBaseUrl(),
  };
};

const payuRequest = async <T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    redirect?: RequestRedirect;
  } = {}
): Promise<T> => {
  const doRequest = async (token: string) => {
    const response = await fetch(`${getPayuBaseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers: getAuthHeaders(token),
      body: options.body != null ? JSON.stringify(options.body) : undefined,
      redirect: options.redirect,
    });

    return response;
  };

  let token = await getPayuAccessToken(false);
  let response = await doRequest(token);

  if (response.status === 401) {
    token = await getPayuAccessToken(true);
    response = await doRequest(token);
  }

  const responseBody = await response.text();
  const parsed = responseBody ? (JSON.parse(responseBody) as any) : {};
  const status = parsed?.status as PayuStatus | undefined;

  if (!response.ok && response.status !== 302) {
    throw new Error(status?.statusDesc || status?.codeLiteral || `PayU API error ${response.status}.`);
  }

  return parsed as T;
};

export const createPayuOrder = async (order: PayuOrderRequest) => {
  const response = await payuRequest<PayuOrderResponse>("/api/v2_1/orders", {
    method: "POST",
    body: order,
    redirect: "manual",
  });

  if (!response.orderId) {
    throw new Error("PayU nie zwrocilo orderId.");
  }

  const statusCode = String(response.status?.statusCode || "").toUpperCase();
  if (statusCode && !["SUCCESS", "WARNING_CONTINUE_CVV", "WARNING_CONTINUE_3DS"].includes(statusCode)) {
    throw new Error(response.status?.statusDesc || `PayU zwrocilo status ${statusCode}.`);
  }

  if (!response.redirectUri) {
    throw new Error("PayU nie zwrocilo redirectUri.");
  }

  return response;
};

export const getPayuOrderStatus = async (orderId: string) => {
  const response = await payuRequest<PayuOrderDetailsResponse>(`/api/v2_1/orders/${encodeURIComponent(orderId)}`);
  const order = response.orders?.[0];

  return {
    statusCode: String(response.status?.statusCode || "").toUpperCase(),
    statusDescription: response.status?.statusDesc || null,
    orderId: order?.orderId || null,
    extOrderId: order?.extOrderId || null,
    paymentStatus: order?.status || null,
    totalAmount: order?.totalAmount ? Number(order.totalAmount) : null,
    currencyCode: order?.currencyCode || null,
  };
};

const parseOpenPayuSignatureHeader = (signatureHeader: string) => {
  const parsed: Record<string, string> = {};
  for (const part of signatureHeader.split(";")) {
    const [rawKey, rawValue] = part.split("=");
    const key = String(rawKey || "").trim().toLowerCase();
    const value = String(rawValue || "").trim();
    if (!key || !value) continue;
    parsed[key] = value;
  }
  return parsed;
};

export const verifyPayuWebhookSignature = (rawBody: Buffer, signatureHeader: string | undefined) => {
  const secondKey = String(env.payuSecondKey || "").trim();
  if (!secondKey) {
    throw new Error("Brak PAYU_SECOND_KEY do weryfikacji webhooka.");
  }
  if (!signatureHeader) {
    throw new Error("Brak naglowka OpenPayu-Signature.");
  }

  const signatureParts = parseOpenPayuSignatureHeader(signatureHeader);
  const expectedSignature = String(signatureParts.signature || "").trim().toLowerCase();
  const algorithm = String(signatureParts.algorithm || "").trim().toUpperCase();

  if (!expectedSignature) {
    throw new Error("Brak podpisu w OpenPayu-Signature.");
  }
  if (algorithm && algorithm !== "MD5") {
    throw new Error(`Nieobslugiwany algorytm podpisu PayU: ${algorithm}`);
  }

  const computedSignature = crypto
    .createHash("md5")
    .update(rawBody)
    .update(secondKey, "utf8")
    .digest("hex")
    .toLowerCase();

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const computedBuffer = Buffer.from(computedSignature, "hex");

  if (expectedBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, computedBuffer)) {
    throw new Error("Nieprawidlowy podpis webhooka PayU.");
  }
};
