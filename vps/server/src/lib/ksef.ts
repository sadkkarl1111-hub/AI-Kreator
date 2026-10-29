const KSEF_URLS = {
  demo: "https://api-demo.ksef.mf.gov.pl/v2",
  test: "https://api-test.ksef.mf.gov.pl/v2",
  prod: "https://api.ksef.mf.gov.pl/v2",
} as const;

type KsefEnvironment = keyof typeof KSEF_URLS;

type KsefLogFn = (step: string, details?: unknown) => void;

type KsefAuthResult = {
  accessToken: string;
  refreshToken: string;
};

type KsefSession = {
  referenceNumber: string;
  aesKey: Uint8Array;
  iv: Uint8Array;
};

type KsefPublicKeyCertificate = {
  certificate?: string;
  usage?: string[] | null;
};

export type KsefInvoiceData = {
  invoiceNumber: string;
  issueDate: string;
  salesDate: string;
  seller: {
    nip: string;
    name: string;
    address: string;
    postalCode: string;
    city: string;
  };
  buyer: {
    name: string;
    nip?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    email?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    vatRate: number | string;
  }>;
  currency: string;
  vatExemptionLegalBasis?: string;
};

export type SendKsefInvoiceParams = {
  token: string;
  nip: string;
  environment?: string;
  invoice: KsefInvoiceData;
  logger?: KsefLogFn;
};

export type SendKsefInvoiceResult = {
  invoiceReferenceNumber: string;
  sessionReferenceNumber: string;
  invoiceNumber: string | null;
  environment: KsefEnvironment;
};

const noopLogger: KsefLogFn = () => undefined;

const bytesToBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

const base64ToBytes = (base64Value: string) => Uint8Array.from(Buffer.from(base64Value, "base64"));

const toCryptoBuffer = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer;

const sha256Base64 = async (data: Uint8Array): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", toCryptoBuffer(data));
  return bytesToBase64(new Uint8Array(hash));
};

const aesEncrypt = async (plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> => {
  const cryptoKey = await crypto.subtle.importKey("raw", toCryptoBuffer(key), "AES-CBC", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: toCryptoBuffer(iv) },
    cryptoKey,
    toCryptoBuffer(plaintext)
  );
  return new Uint8Array(encrypted);
};

const extractSpkiFromX509 = (certificateBytes: Uint8Array): Uint8Array => {
  let offset = 0;

  const readTag = () => {
    if (offset + 2 > certificateBytes.length) {
      throw new Error("Invalid X.509 certificate format");
    }

    const tag = certificateBytes[offset++];
    let length = certificateBytes[offset++];
    let bodyOffset = offset;

    if (length & 0x80) {
      const numBytes = length & 0x7f;
      if (offset + numBytes > certificateBytes.length) {
        throw new Error("Invalid X.509 certificate length");
      }
      length = 0;
      for (let index = 0; index < numBytes; index += 1) {
        length = (length << 8) | certificateBytes[offset++];
      }
      bodyOffset = offset;
    }

    const end = bodyOffset + length;
    if (end > certificateBytes.length) {
      throw new Error("Invalid X.509 certificate body");
    }

    return { tag, length, bodyOffset, end };
  };

  // Root sequence
  readTag();
  // tbsCertificate sequence
  readTag();

  // Optional version
  if (certificateBytes[offset] === 0xa0) {
    const version = readTag();
    offset = version.end;
  }

  const serialNumber = readTag();
  offset = serialNumber.end;

  const signature = readTag();
  offset = signature.end;

  const issuer = readTag();
  offset = issuer.end;

  const validity = readTag();
  offset = validity.end;

  const subject = readTag();
  offset = subject.end;

  const spkiStart = offset;
  const spki = readTag();
  return certificateBytes.slice(spkiStart, spki.end);
};

const rsaEncryptWithCertificate = async (data: Uint8Array, certBase64: string): Promise<Uint8Array> => {
  const certBytes = base64ToBytes(certBase64);

  try {
    const key = await crypto.subtle.importKey(
      "spki",
      toCryptoBuffer(certBytes),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );
    const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, toCryptoBuffer(data));
    return new Uint8Array(encrypted);
  } catch {
    const spki = extractSpkiFromX509(certBytes);
    const key = await crypto.subtle.importKey(
      "spki",
      toCryptoBuffer(spki),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );
    const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, toCryptoBuffer(data));
    return new Uint8Array(encrypted);
  }
};

const parseCertificates = (payload: unknown): KsefPublicKeyCertificate[] => {
  if (!Array.isArray(payload)) return [];
  return payload.filter((item): item is KsefPublicKeyCertificate => Boolean(item) && typeof item === "object");
};

const getCertificateByUsage = (payload: unknown, usage: string) => {
  const certificates = parseCertificates(payload);
  const matched = certificates.find((cert) => Array.isArray(cert.usage) && cert.usage.includes(usage));
  const certificate = matched?.certificate;
  if (!certificate) {
    throw new Error(`No ${usage} certificate found`);
  }
  return certificate;
};

const getJsonResponse = async <T>(response: Response, label: string): Promise<T> => {
  const json = await response.json().catch(() => null);
  if (!json) {
    throw new Error(`${label}: invalid JSON response`);
  }
  return json as T;
};

const resolveEnvironment = (value?: string): KsefEnvironment => {
  const normalized = String(value || "").toLowerCase() as KsefEnvironment;
  if (normalized === "demo" || normalized === "test" || normalized === "prod") {
    return normalized;
  }
  return "demo";
};

const ksefAuth = async (
  baseUrl: string,
  nip: string,
  tokenFull: string,
  logger: KsefLogFn
): Promise<KsefAuthResult> => {
  const tokenParts = tokenFull.split("|");
  if (tokenParts.length !== 3) {
    throw new Error("Invalid KSeF token format (expected 3 parts separated by |)");
  }

  logger("auth-challenge:start");
  const challengeRes = await fetch(`${baseUrl}/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!challengeRes.ok) {
    const errorBody = await challengeRes.text();
    throw new Error(`Challenge failed [${challengeRes.status}]: ${errorBody}`);
  }

  const challengeData = await getJsonResponse<{ challenge?: string; timestampMs?: number }>(
    challengeRes,
    "challenge"
  );
  const challenge = challengeData.challenge;
  const timestampMs = challengeData.timestampMs;
  if (!challenge || !timestampMs) {
    throw new Error("Challenge response missing fields");
  }

  logger("auth-certificates:fetch");
  const certsRes = await fetch(`${baseUrl}/security/public-key-certificates`);
  if (!certsRes.ok) {
    const errorBody = await certsRes.text();
    throw new Error(`Public key certs failed [${certsRes.status}]: ${errorBody}`);
  }
  const certificatesPayload = await certsRes.json().catch(() => []);
  const tokenEncryptionCertificate = getCertificateByUsage(certificatesPayload, "KsefTokenEncryption");

  const tokenWithTimestamp = `${tokenFull}|${timestampMs}`;
  const encryptedToken = await rsaEncryptWithCertificate(new TextEncoder().encode(tokenWithTimestamp), tokenEncryptionCertificate);
  const encryptedTokenBase64 = bytesToBase64(encryptedToken);

  logger("auth-token:start");
  const tokenAuthRes = await fetch(`${baseUrl}/auth/ksef-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challenge,
      contextIdentifier: { type: "Nip", value: nip },
      encryptedToken: encryptedTokenBase64,
    }),
  });
  if (!tokenAuthRes.ok) {
    const errorBody = await tokenAuthRes.text();
    throw new Error(`Token auth failed [${tokenAuthRes.status}]: ${errorBody}`);
  }

  const tokenAuthData = await getJsonResponse<{
    referenceNumber?: string;
    authenticationToken?: { token?: string };
  }>(tokenAuthRes, "token auth");
  const authReferenceNumber = tokenAuthData.referenceNumber;
  const authToken = tokenAuthData.authenticationToken?.token;

  if (!authReferenceNumber || !authToken) {
    throw new Error("Token auth response missing reference number or auth token");
  }

  logger("auth-status:poll");
  let authCompleted = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const statusRes = await fetch(`${baseUrl}/auth/${authReferenceNumber}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!statusRes.ok) continue;

    const statusData = await statusRes.json().catch(() => null) as
      | { status?: { code?: number; description?: string; details?: unknown } }
      | null;
    const statusCode = statusData?.status?.code;
    if (statusCode === 200) {
      authCompleted = true;
      break;
    }
    if (typeof statusCode === "number" && statusCode >= 400) {
      throw new Error(
        `Auth failed: ${statusData?.status?.description || "unknown"} - ${JSON.stringify(statusData?.status?.details ?? null)}`
      );
    }
  }

  if (!authCompleted) {
    throw new Error("Auth timeout - status never reached 200");
  }

  logger("auth-token:redeem");
  const redeemRes = await fetch(`${baseUrl}/auth/token/redeem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });
  if (!redeemRes.ok) {
    const errorBody = await redeemRes.text();
    throw new Error(`Token redeem failed [${redeemRes.status}]: ${errorBody}`);
  }

  const redeemData = await getJsonResponse<{
    accessToken?: { token?: string };
    refreshToken?: { token?: string };
  }>(redeemRes, "token redeem");

  const accessToken = redeemData.accessToken?.token;
  const refreshToken = redeemData.refreshToken?.token;
  if (!accessToken || !refreshToken) {
    throw new Error("Token redeem response missing access or refresh token");
  }

  return { accessToken, refreshToken };
};

const ksefOpenSession = async (baseUrl: string, accessToken: string, logger: KsefLogFn): Promise<KsefSession> => {
  const aesKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(16));

  logger("session-certificates:fetch");
  const certsRes = await fetch(`${baseUrl}/security/public-key-certificates`);
  if (!certsRes.ok) {
    const errorBody = await certsRes.text();
    throw new Error(`Public key certs failed [${certsRes.status}]: ${errorBody}`);
  }
  const certificatesPayload = await certsRes.json().catch(() => []);
  const symmetricKeyCertificate = getCertificateByUsage(certificatesPayload, "SymmetricKeyEncryption");

  const encryptedSymmetricKey = await rsaEncryptWithCertificate(aesKey, symmetricKeyCertificate);
  const encryptedSymmetricKeyBase64 = bytesToBase64(encryptedSymmetricKey);
  const initializationVectorBase64 = bytesToBase64(iv);

  logger("session-open:start");
  const sessionRes = await fetch(`${baseUrl}/sessions/online`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      formCode: {
        systemCode: "FA (3)",
        schemaVersion: "1-0E",
        value: "FA",
      },
      encryption: {
        encryptedSymmetricKey: encryptedSymmetricKeyBase64,
        initializationVector: initializationVectorBase64,
      },
    }),
  });
  if (!sessionRes.ok) {
    const errorBody = await sessionRes.text();
    throw new Error(`Session open failed [${sessionRes.status}]: ${errorBody}`);
  }

  const sessionData = await getJsonResponse<{ referenceNumber?: string }>(sessionRes, "session open");
  if (!sessionData.referenceNumber) {
    throw new Error("Session open response missing reference number");
  }

  return {
    referenceNumber: sessionData.referenceNumber,
    aesKey,
    iv,
  };
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildFA3InvoiceXml = (data: KsefInvoiceData): string => {
  const normalizeVatRate = (rate: number | string) => String(rate).trim();
  const isVatExemptRate = (rate: string) => rate.toLowerCase() === "zw";
  const toMoney = (value: number) => value.toFixed(2);
  const toQuantity = (value: number) => {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(8).replace(/\.?0+$/, "");
  };
  const buildAddressLine = (address?: string, postalCode?: string, city?: string) => {
    const main = String(address || "").trim();
    const locality = [String(postalCode || "").trim(), String(city || "").trim()].filter(Boolean).join(" ");
    return [main, locality].filter(Boolean).join(", ");
  };

  const sellerAddressLine =
    buildAddressLine(data.seller.address, data.seller.postalCode, data.seller.city) || "Brak adresu";
  const buyerAddressLine = buildAddressLine(data.buyer.address, data.buyer.postalCode, data.buyer.city);
  const buyerName = String(data.buyer.name || data.buyer.email || "Nabywca").trim();
  const buyerEmail = String(data.buyer.email || "").trim();
  const generatedAt = new Date().toISOString();

  const itemsXml = data.items
    .map((item, index) => {
      const vatRateCode = normalizeVatRate(item.vatRate);
      const netValue = item.quantity * item.unitPrice;
      return [
        "<FaWiersz>",
        `<NrWierszaFa>${index + 1}</NrWierszaFa>`,
        `<P_7>${escapeXml(item.name)}</P_7>`,
        "<P_8A>szt.</P_8A>",
        `<P_8B>${toQuantity(item.quantity)}</P_8B>`,
        `<P_9A>${toMoney(item.unitPrice)}</P_9A>`,
        `<P_11>${toMoney(netValue)}</P_11>`,
        `<P_12>${escapeXml(vatRateCode)}</P_12>`,
        "</FaWiersz>",
      ].join("");
    })
    .join("");

  const hasVatExemptItems = data.items.some((item) => isVatExemptRate(normalizeVatRate(item.vatRate)));
  const totalNet = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalVat = data.items.reduce((sum, item) => {
    const vatRateCode = normalizeVatRate(item.vatRate);
    if (isVatExemptRate(vatRateCode)) return sum;
    const numericVatRate = Number(vatRateCode);
    if (!Number.isFinite(numericVatRate) || numericVatRate <= 0) return sum;
    return sum + (item.quantity * item.unitPrice * numericVatRate) / 100;
  }, 0);
  const totalGross = totalNet + totalVat;

  const salesSummaryXml = hasVatExemptItems
    ? `<P_13_7>${toMoney(totalNet)}</P_13_7>`
    : [`<P_13_1>${toMoney(totalNet)}</P_13_1>`, `<P_14_1>${toMoney(totalVat)}</P_14_1>`].join("");

  const vatExemptionLegalBasis = escapeXml(data.vatExemptionLegalBasis || "Art. 113 ust. 1 i 9 ustawy o VAT");
  const vatAnnotationsXml = hasVatExemptItems
    ? ["<Zwolnienie>", "<P_19>1</P_19>", `<P_19A>${vatExemptionLegalBasis}</P_19A>`, "</Zwolnienie>"].join("")
    : "<Zwolnienie><P_19N>1</P_19N></Zwolnienie>";

  const buyerIdentityXml = data.buyer.nip
    ? [
        "<DaneIdentyfikacyjne>",
        `<NIP>${escapeXml(data.buyer.nip)}</NIP>`,
        buyerName ? `<Nazwa>${escapeXml(buyerName)}</Nazwa>` : "",
        "</DaneIdentyfikacyjne>",
      ].join("")
    : [
        "<DaneIdentyfikacyjne>",
        "<BrakID>1</BrakID>",
        buyerName ? `<Nazwa>${escapeXml(buyerName)}</Nazwa>` : "",
        "</DaneIdentyfikacyjne>",
      ].join("");

  const buyerAddressXml = buyerAddressLine
    ? ["<Adres>", "<KodKraju>PL</KodKraju>", `<AdresL1>${escapeXml(buyerAddressLine)}</AdresL1>`, "</Adres>"].join("")
    : "";
  const buyerContactXml =
    buyerEmail && buyerEmail.includes("@")
      ? ["<DaneKontaktowe>", `<Email>${escapeXml(buyerEmail)}</Email>`, "</DaneKontaktowe>"].join("")
      : "";

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">',
    "<Naglowek>",
    '<KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>',
    "<WariantFormularza>3</WariantFormularza>",
    `<DataWytworzeniaFa>${generatedAt}</DataWytworzeniaFa>`,
    "<SystemInfo>KreatorAI</SystemInfo>",
    "</Naglowek>",
    "<Podmiot1>",
    "<DaneIdentyfikacyjne>",
    `<NIP>${escapeXml(data.seller.nip)}</NIP>`,
    `<Nazwa>${escapeXml(data.seller.name)}</Nazwa>`,
    "</DaneIdentyfikacyjne>",
    "<Adres>",
    "<KodKraju>PL</KodKraju>",
    `<AdresL1>${escapeXml(sellerAddressLine)}</AdresL1>`,
    "</Adres>",
    "</Podmiot1>",
    "<Podmiot2>",
    buyerIdentityXml,
    buyerAddressXml,
    buyerContactXml,
    "<JST>2</JST>",
    "<GV>2</GV>",
    "</Podmiot2>",
    "<Fa>",
    `<KodWaluty>${escapeXml(data.currency)}</KodWaluty>`,
    `<P_1>${data.issueDate}</P_1>`,
    `<P_2>${escapeXml(data.invoiceNumber)}</P_2>`,
    `<P_6>${data.salesDate}</P_6>`,
    salesSummaryXml,
    `<P_15>${toMoney(totalGross)}</P_15>`,
    "<Adnotacje>",
    "<P_16>2</P_16>",
    "<P_17>2</P_17>",
    "<P_18>2</P_18>",
    "<P_18A>2</P_18A>",
    vatAnnotationsXml,
    "<NoweSrodkiTransportu><P_22N>1</P_22N></NoweSrodkiTransportu>",
    "<P_23>2</P_23>",
    "<PMarzy><P_PMarzyN>1</P_PMarzyN></PMarzy>",
    "</Adnotacje>",
    "<RodzajFaktury>VAT</RodzajFaktury>",
    itemsXml,
    "</Fa>",
    "</Faktura>",
  ].join("");
};

const ksefSendInvoice = async (
  baseUrl: string,
  accessToken: string,
  session: KsefSession,
  invoiceXml: string,
  logger: KsefLogFn
): Promise<{ referenceNumber: string }> => {
  const plainText = new TextEncoder().encode(invoiceXml);
  const encryptedContent = await aesEncrypt(plainText, session.aesKey, session.iv);

  const invoiceHash = await sha256Base64(plainText);
  const encryptedInvoiceHash = await sha256Base64(encryptedContent);

  logger("invoice-send:start", { size: plainText.length });
  const sendRes = await fetch(`${baseUrl}/sessions/online/${session.referenceNumber}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      invoiceHash,
      invoiceSize: plainText.length,
      encryptedInvoiceHash,
      encryptedInvoiceSize: encryptedContent.length,
      encryptedInvoiceContent: bytesToBase64(encryptedContent),
    }),
  });

  if (!sendRes.ok) {
    const errorBody = await sendRes.text();
    throw new Error(`Invoice send failed [${sendRes.status}]: ${errorBody}`);
  }

  const sendData = await getJsonResponse<{ referenceNumber?: string }>(sendRes, "invoice send");
  if (!sendData.referenceNumber) {
    throw new Error("Invoice send response missing reference number");
  }

  return { referenceNumber: sendData.referenceNumber };
};

const ksefCloseSession = async (baseUrl: string, accessToken: string, referenceNumber: string, logger: KsefLogFn) => {
  logger("session-close:start", { referenceNumber });
  const closeRes = await fetch(`${baseUrl}/sessions/online/${referenceNumber}/close`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!closeRes.ok && closeRes.status !== 204) {
    const closeError = await closeRes.text().catch(() => "");
    logger("session-close:warning", { status: closeRes.status, closeError });
  }
};

const extractStatusCode = (payload: unknown): number | null => {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  const candidates: unknown[] = [
    record.status,
    record.invoiceStatus,
    record.sessionStatus,
    record.processingStatus,
    record.result,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const code = (candidate as Record<string, unknown>).code;
    if (typeof code === "number") return code;
    if (typeof code === "string" && code.trim()) {
      const parsed = Number(code);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  if (typeof record.code === "number") return record.code;
  if (typeof record.code === "string" && record.code.trim()) {
    const parsed = Number(record.code);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
};

const extractStatusDescription = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  const candidates: unknown[] = [
    record.status,
    record.invoiceStatus,
    record.sessionStatus,
    record.processingStatus,
    record.result,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;
    const value = entry.description ?? entry.message ?? entry.reason;
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const direct = record.description ?? record.message ?? record.reason;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  return null;
};

const extractStatusDetails = (payload: unknown): unknown => {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  const candidates: unknown[] = [
    record.status,
    record.invoiceStatus,
    record.sessionStatus,
    record.processingStatus,
    record.result,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;
    if (entry.details !== undefined) return entry.details;
    if (entry.errors !== undefined) return entry.errors;
  }

  return record.details ?? record.errors ?? null;
};

const extractKsefInvoiceNumber = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const officialNumberPattern = /^\d{10}-\d{8}-[A-Z0-9]{12}-[A-Z0-9]{2}$/i;

  const pickOfficial = (value: unknown) => {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    if (!normalized) return null;
    return officialNumberPattern.test(normalized) ? normalized : null;
  };

  const candidates: unknown[] = [
    record.ksefNumber,
    record.invoiceNumberKsef,
    record.numberKSeF,
    record.numberKsef,
    record.number,
    (record.invoice as Record<string, unknown> | undefined)?.ksefNumber,
    (record.invoice as Record<string, unknown> | undefined)?.invoiceNumberKsef,
  ];

  for (const candidate of candidates) {
    const found = pickOfficial(candidate);
    if (found) {
      return found;
    }
  }

  const queue: unknown[] = [payload];
  let scanned = 0;
  while (queue.length > 0 && scanned < 300) {
    scanned += 1;
    const current = queue.shift();
    if (typeof current === "string") {
      const match = current.match(/\d{10}-\d{8}-[A-Z0-9]{12}-[A-Z0-9]{2}/i);
      if (match?.[0]) {
        const found = pickOfficial(match[0]);
        if (found) return found;
      }
      continue;
    }
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (current && typeof current === "object") {
      queue.push(...Object.values(current as Record<string, unknown>));
    }
  }

  return null;
};

const describeDetails = (details: unknown): string => {
  if (details == null) return "";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
};

const waitForInvoiceProcessingResult = async (
  baseUrl: string,
  accessToken: string,
  sessionReferenceNumber: string,
  invoiceReferenceNumber: string,
  logger: KsefLogFn
): Promise<{ ksefInvoiceNumber: string | null }> => {
  const endpoints = [
    `/sessions/online/${sessionReferenceNumber}/invoices/${invoiceReferenceNumber}`,
    `/sessions/${sessionReferenceNumber}/invoices/${invoiceReferenceNumber}`,
    `/invoices/${invoiceReferenceNumber}`,
  ];

  const maxAttempts = 45;
  const delayMs = 2000;
  let hasAnySuccessfulStatusCall = false;
  let lastStatusCode: number | null = null;
  let lastStatusDescription: string | null = null;
  let lastStatusDetails: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const endpoint of endpoints) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 404 || response.status === 405) {
        continue;
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        logger("invoice-status:non-ok", {
          endpoint,
          attempt,
          httpStatus: response.status,
          body: bodyText.slice(0, 400),
        });
        continue;
      }

      hasAnySuccessfulStatusCall = true;

      const payload = (await response.json().catch(() => null)) as unknown;
      if (!payload) {
        continue;
      }

      const statusCode = extractStatusCode(payload);
      const statusDescription = extractStatusDescription(payload);
      const statusDetails = extractStatusDetails(payload);
      const ksefInvoiceNumber = extractKsefInvoiceNumber(payload);

      if (statusCode !== null) {
        lastStatusCode = statusCode;
      }
      if (statusDescription) {
        lastStatusDescription = statusDescription;
      }
      if (statusDetails != null) {
        lastStatusDetails = statusDetails;
      }

      logger("invoice-status:poll", {
        endpoint,
        attempt,
        statusCode,
        statusDescription,
      });

      if (statusCode === 200) {
        return { ksefInvoiceNumber: ksefInvoiceNumber || null };
      }

      if (typeof statusCode === "number" && statusCode >= 400) {
        const detailsText = describeDetails(statusDetails);
        const parts = [`KSeF odrzucil dokument [${statusCode}]`];
        if (statusDescription) parts.push(statusDescription);
        if (detailsText) parts.push(detailsText);
        throw new Error(parts.join(" - "));
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  if (!hasAnySuccessfulStatusCall) {
    throw new Error("Nie udalo sie pobrac statusu dokumentu z KSeF po wysylce.");
  }

  const fallback = [`Timeout oczekiwania na koncowy status KSeF`];
  if (lastStatusCode != null) fallback.push(`kod=${lastStatusCode}`);
  if (lastStatusDescription) fallback.push(lastStatusDescription);
  const detailsText = describeDetails(lastStatusDetails);
  if (detailsText) fallback.push(detailsText);
  throw new Error(fallback.join(" - "));
};

export const sendInvoiceToKsef = async (params: SendKsefInvoiceParams): Promise<SendKsefInvoiceResult> => {
  const logger = params.logger ?? noopLogger;
  const environment = resolveEnvironment(params.environment);
  const baseUrl = KSEF_URLS[environment];
  const invoiceXml = buildFA3InvoiceXml(params.invoice);

  logger("invoice-xml:ready", { size: invoiceXml.length, environment });

  const auth = await ksefAuth(baseUrl, params.nip, params.token, logger);
  const session = await ksefOpenSession(baseUrl, auth.accessToken, logger);

  let sendResult: { referenceNumber: string };
  let ksefInvoiceNumber: string | null = null;
  try {
    sendResult = await ksefSendInvoice(baseUrl, auth.accessToken, session, invoiceXml, logger);
    const statusResult = await waitForInvoiceProcessingResult(
      baseUrl,
      auth.accessToken,
      session.referenceNumber,
      sendResult.referenceNumber,
      logger
    );
    ksefInvoiceNumber = statusResult.ksefInvoiceNumber;
  } finally {
    await ksefCloseSession(baseUrl, auth.accessToken, session.referenceNumber, logger).catch(() => undefined);
  }

  return {
    invoiceReferenceNumber: sendResult.referenceNumber,
    sessionReferenceNumber: session.referenceNumber,
    invoiceNumber: ksefInvoiceNumber,
    environment,
  };
};
