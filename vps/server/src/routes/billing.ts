import { randomUUID } from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import {
  completeLocalCreditPurchase,
  createLocalCreditPurchase,
  getLocalCreditPackageById,
  getLocalCreditPurchaseById,
  getLocalCreditPurchaseByPaymentOrderId,
  getLocalCreditPurchaseByPaymentSessionId,
  getLocalInvoiceSettings,
  listLocalCreditPackages,
  listLocalCreditPurchases,
  listLocalCreditUsage,
  updateLocalCreditPurchase,
  type CreditPurchaseRow,
} from "../lib/localBillingData.js";
import { getLocalMailerLiteConfig, getLocalMailerLitePackageGroupByPackageId, getLocalSettingsMap } from "../lib/localCoreData.js";
import { getLocalAuthUser, getLocalProfile, hasLocalUserRole } from "../lib/localUserData.js";
import { sendInvoiceToKsef } from "../lib/ksef.js";
import { resolveLocalCouponDiscount } from "../lib/localCoupons.js";
import {
  createCheckoutPayment,
  getCheckoutPaymentStatus,
  getConfiguredPaymentProvider,
  getPaymentWebhookPath,
  parsePaymentWebhook,
} from "../lib/paymentGateway.js";
import { todoRoute } from "../lib/todoRoute.js";
import { requireAuthenticatedUser } from "../middleware/requireAuthenticatedUser.js";
import { createRateLimitMiddleware } from "../middleware/rateLimit.js";

export const billingRouter = Router();

const MAILERLITE_API_BASE = "https://connect.mailerlite.com/api";

type CheckoutBody = {
  packageId?: string;
  couponCode?: string;
  origin?: string;
  billing?: {
    type?: string;
    name?: string;
    nip?: string;
    company?: string;
    address?: string;
    postalCode?: string;
    city?: string;
  };
};

type VerifyPaymentBody = {
  sessionId?: string;
};

type CouponPreviewBody = {
  couponCode?: string;
};

type GenerateInvoiceBody = {
  purchaseId?: string;
};

type CreditPackage = {
  id: string;
  label: string;
  credits: number;
  price_grosze: number;
  active: boolean;
};

type CreditPurchase = {
  id: string;
  credits: number;
  amount: number;
  paid_amount: number | null;
  status: string;
  created_at: string;
  ksef_reference_number?: string | null;
  ksef_invoice_number?: string | null;
  ksef_session_reference_number?: string | null;
  ksef_environment?: string | null;
  ksef_sent_at?: string | null;
  ksef_error?: string | null;
};

type CreditUsage = {
  id: string;
  credits_used: number;
  model: string;
  created_at: string;
};

const compactRateLimitKeys = (...values: Array<string | null | undefined>) =>
  values.filter((value): value is string => Boolean(value));

type NormalizedCheckoutBilling = {
  type: "company" | "individual";
  name: string | null;
  nip: string | null;
  company: string | null;
  address: string;
  postalCode: string;
  city: string;
};

const mailerLiteRequest = async <T>(apiKey: string, path: string, options: { method?: string; body?: unknown } = {}) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${MAILERLITE_API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => null) as
    | ({ message?: string; error?: string | { message?: string } } & T)
    | null;

  if (!response.ok) {
    const nestedMessage = typeof data?.error === "object" ? data.error.message : data?.error;
    throw new Error(data?.message || nestedMessage || `MailerLite zwrocil blad ${response.status}.`);
  }

  return data as T;
};

const subscribePurchaseToMailerLite = async (input: {
  packageId?: string | null;
  userId: string;
  email?: string | null;
}) => {
  const normalizedPackageId = String(input.packageId || "").trim();
  if (!normalizedPackageId) return;

  try {
    const mapping = await getLocalMailerLitePackageGroupByPackageId(normalizedPackageId);
    const groupId = mapping?.group_id?.trim();
    if (!groupId) return;

    const config = await getLocalMailerLiteConfig();
    const apiKey = config?.api_key?.trim();
    if (!apiKey) return;

    let email = String(input.email || "").trim().toLowerCase();
    if (!email) {
      const authUser = await getLocalAuthUser(input.userId).catch(() => null);
      email = String(authUser?.email || "").trim().toLowerCase();
    }
    if (!email) return;

    await mailerLiteRequest(apiKey, "/subscribers", {
      method: "POST",
      body: {
        email,
        groups: [groupId],
      },
    });
  } catch (error) {
    console.error("VPS billing mailerlite subscribe error:", error);
  }
};

const buildSuccessUrl = (origin: string | undefined, sessionId: string) => {
  const baseOrigin = origin?.startsWith("http") ? origin : env.appUrl;
  return `${baseOrigin}/credits?session_id=${encodeURIComponent(sessionId)}&success=true`;
};

const getRequestClientIp = (request: { headers: Record<string, unknown>; ip?: string }) => {
  const forwardedHeader = request.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwardedHeader) ? forwardedHeader[0] : forwardedHeader;
  const firstForwarded = String(forwardedValue || "")
    .split(",")
    .map((part) => part.trim())
    .find(Boolean);

  return firstForwarded || request.ip || "127.0.0.1";
};

const billingCouponPreviewRateLimit = createRateLimitMiddleware({
  scope: "billing:coupon-preview",
  max: 30,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele prob sprawdzania kodow rabatowych. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) =>
    compactRateLimitKeys(`ip:${getRequestClientIp(request)}`, request.authUser?.id ? `user:${request.authUser.id}` : null),
});

const billingCheckoutRateLimit = createRateLimitMiddleware({
  scope: "billing:checkout",
  max: 6,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele prob rozpoczecia platnosci. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) =>
    compactRateLimitKeys(`ip:${getRequestClientIp(request)}`, request.authUser?.id ? `user:${request.authUser.id}` : null),
});

const billingVerifyRateLimit = createRateLimitMiddleware({
  scope: "billing:verify",
  max: 30,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele prob weryfikacji platnosci. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) =>
    compactRateLimitKeys(`ip:${getRequestClientIp(request)}`, request.authUser?.id ? `user:${request.authUser.id}` : null),
});

const billingInvoiceGenerateRateLimit = createRateLimitMiddleware({
  scope: "billing:invoice-generate",
  max: 20,
  windowMs: 10 * 60 * 1000,
  message: "Zbyt wiele prob generowania faktury. Sprobuj ponownie za kilka minut.",
  keyResolver: (request) =>
    compactRateLimitKeys(`ip:${getRequestClientIp(request)}`, request.authUser?.id ? `user:${request.authUser.id}` : null),
});

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalizeDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const normalizePostalCode = (value: unknown) => {
  const digits = normalizeDigits(value).slice(0, 5);
  if (digits.length !== 5) return "";
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
};

const sanitizeBuyerAddress = (address: unknown, nip: unknown) => {
  const trimmed = String(address ?? "").trim();
  if (!trimmed) return "";

  const addressDigits = normalizeDigits(trimmed);
  const nipDigits = normalizeDigits(nip);
  if (addressDigits && nipDigits && addressDigits === nipDigits) {
    return "";
  }

  return trimmed;
};

const normalizeCheckoutBilling = (billing?: CheckoutBody["billing"]): NormalizedCheckoutBilling => {
  if (!billing || typeof billing !== "object") {
    throw new Error("Uzupelnij dane nabywcy przed przejsciem do platnosci.");
  }

  const type = String(billing.type || "").trim().toLowerCase();
  if (type !== "company" && type !== "individual") {
    throw new Error("Wybierz typ nabywcy: osoba prywatna albo firma.");
  }

  const address = sanitizeBuyerAddress(billing.address, billing.nip);
  const postalCodeDigits = normalizeDigits(billing.postalCode).slice(0, 5);
  const postalCode = postalCodeDigits.length === 5 ? normalizePostalCode(billing.postalCode) : "";
  const city = String(billing.city || "").trim();

  if (type === "company") {
    if (!address) {
      throw new Error("Adres jest wymagany do faktury.");
    }
    if (!postalCode) {
      throw new Error("Kod pocztowy musi miec format 00-000.");
    }
    if (!city) {
      throw new Error("Miasto jest wymagane do faktury.");
    }

    const nip = normalizeDigits(billing.nip).slice(0, 10);
    const company = String(billing.company || "").trim();
    if (nip.length !== 10) {
      throw new Error("NIP musi miec dokladnie 10 cyfr.");
    }
    if (!company) {
      throw new Error("Nazwa firmy jest wymagana do faktury.");
    }

    return {
      type,
      name: null,
      nip,
      company,
      address,
      postalCode,
      city,
    };
  }

  const name = String(billing.name || "").trim();
  if (!name) {
    throw new Error("Imie i nazwisko sa wymagane do faktury.");
  }
  if (postalCodeDigits.length > 0 && postalCodeDigits.length !== 5) {
    throw new Error("Kod pocztowy musi miec format 00-000.");
  }

  return {
    type,
    name,
    nip: null,
    company: null,
    address,
    postalCode,
    city,
  };
};

const KSEF_NUMBER_PATTERN = /^\d{10}-\d{8}-[A-Z0-9]{12}-[A-Z0-9]{2}$/i;

const isOfficialKsefNumber = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return false;
  return KSEF_NUMBER_PATTERN.test(normalized);
};

const isAdminUser = async (userId: string) => {
  return hasLocalUserRole(userId, "admin");
};

const generateInvoiceHtml = async (purchaseId: string, requesterUserId: string) => {
  const isAdmin = await isAdminUser(requesterUserId);
  const purchase = await getLocalCreditPurchaseById(purchaseId);

  if (!purchase) {
    throw new Error("Nie znaleziono zakupu.");
  }

  if (!isAdmin && purchase.user_id !== requesterUserId) {
    throw new Error("Brak dost\u0119pu do tej faktury.");
  }

  const profileData = await getLocalProfile(purchase.user_id);
  const sellerData = await getLocalInvoiceSettings();

  const seller = {
    company_name: sellerData?.company_name || "Kreator AI",
    nip: sellerData?.nip || "",
    address: sellerData?.address || "",
    postal_code: sellerData?.postal_code || "",
    city: sellerData?.city || "",
    email: sellerData?.email || "",
  };

  const invoiceDate = new Date(purchase.created_at || new Date().toISOString());
  const invoiceNumber = `FV/${invoiceDate.getFullYear()}/${String(invoiceDate.getMonth() + 1).padStart(2, "0")}/${purchase.id
    .slice(0, 8)
    .toUpperCase()}`;
  const amountGross = purchase.paid_amount != null ? purchase.paid_amount : purchase.amount;
  const amountGrossPln = amountGross / 100;
  const isVatExempt = true;
  const vatRate = isVatExempt ? 0 : 23;
  const netValueNumber = isVatExempt ? amountGrossPln : amountGrossPln / 1.23;
  const netValue = netValueNumber.toFixed(2);
  const vatValue = isVatExempt ? "0.00" : (amountGrossPln - netValueNumber).toFixed(2);
  const issueDate = invoiceDate.toLocaleDateString("pl-PL");
  const buyerIsIndividual = purchase.billing_type === "individual";
  const buyerName = buyerIsIndividual
    ? purchase.billing_name || profileData?.display_name || profileData?.email || "Nabywca"
    : purchase.billing_company || purchase.billing_name || profileData?.display_name || profileData?.email || "Nabywca";

  const sellerNipLine = seller.nip ? `<p>NIP: ${escapeHtml(seller.nip)}</p>` : "";
  const sellerAddressLine = seller.address ? `<p>${escapeHtml(seller.address)}</p>` : "";
  const sellerCityLine =
    seller.postal_code || seller.city
      ? `<p>${escapeHtml(seller.postal_code)} ${escapeHtml(seller.city)}</p>`
      : "";
  const sellerEmailLine = seller.email ? `<p>${escapeHtml(seller.email)}</p>` : "";
  const buyerNipLine = !buyerIsIndividual && purchase.billing_nip ? `<p>NIP: ${escapeHtml(purchase.billing_nip)}</p>` : "";
  const normalizedBuyerAddress = sanitizeBuyerAddress(purchase.billing_address, purchase.billing_nip);
  const buyerAddressLine = normalizedBuyerAddress ? `<p>${escapeHtml(normalizedBuyerAddress)}</p>` : "";
  const buyerCityLine =
    purchase.billing_postal_code || purchase.billing_city
      ? `<p>${escapeHtml(purchase.billing_postal_code)} ${escapeHtml(purchase.billing_city)}</p>`
      : "";
  const buyerEmailLine = profileData?.email ? `<p>${escapeHtml(profileData.email)}</p>` : "";
  const buyerMissingDataLine =
    purchase.billing_name || purchase.billing_company || purchase.billing_nip || normalizedBuyerAddress || purchase.billing_postal_code || purchase.billing_city
      ? ""
      : "<p><em>Brak danych nabywcy zapisanych przy zakupie.</em></p>";
  const officialKsefNumber = isOfficialKsefNumber(purchase.ksef_invoice_number)
    ? String(purchase.ksef_invoice_number)
    : "";
  const fallbackReference = String(purchase.ksef_reference_number || "").trim();
  const ksefReferenceLine = officialKsefNumber
    ? `<p>Numer KSeF: <strong>${escapeHtml(officialKsefNumber)}</strong></p>`
    : fallbackReference
      ? `<p>Numer referencyjny KSeF: <strong>${escapeHtml(fallbackReference)}</strong></p>`
      : "";

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Faktura ${escapeHtml(invoiceNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .header h1 { font-size: 24px; font-weight: 700; }
    .header .meta { text-align: right; color: #666; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 40px; }
    .party { flex: 1; }
    .party h3 { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 8px; letter-spacing: 1px; }
    .party p { margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #f5f5f5; text-align: left; padding: 10px 12px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ddd; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    .totals { text-align: right; }
    .totals .row { display: flex; justify-content: flex-end; gap: 30px; padding: 4px 0; }
    .totals .total { font-size: 18px; font-weight: 700; border-top: 2px solid #1a1a1a; padding-top: 8px; margin-top: 4px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 11px; text-align: center; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #7c3aed; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .print-btn:hover { background: #6d28d9; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Drukuj / Zapisz PDF</button>
  <div class="header">
    <div>
      <h1>FAKTURA</h1>
      <p style="color: #888; margin-top: 4px;">${escapeHtml(invoiceNumber)}</p>
    </div>
    <div class="meta">
      <p>Data wystawienia: <strong>${issueDate}</strong></p>
      <p>Data sprzeda\u017cy: <strong>${issueDate}</strong></p>
      <p>Metoda p\u0142atno\u015bci: <strong>Przelew online</strong></p>
      ${ksefReferenceLine}
    </div>
  </div>
  <div class="parties">
    <div class="party">
      <h3>Sprzedawca</h3>
      <p><strong>${escapeHtml(seller.company_name)}</strong></p>
      ${sellerNipLine}
      ${sellerAddressLine}
      ${sellerCityLine}
      ${sellerEmailLine}
    </div>
    <div class="party">
      <h3>Nabywca</h3>
      <p><strong>${escapeHtml(buyerName)}</strong></p>
      ${buyerNipLine}
      ${buyerAddressLine}
      ${buyerCityLine}
      ${buyerEmailLine}
      ${buyerMissingDataLine}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Lp.</th>
        <th>Nazwa</th>
        <th>Ilo\u015b\u0107</th>
        <th>Cena netto</th>
        <th>VAT</th>
        <th>Kwota brutto</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Pakiet kredyt\u00f3w - ${escapeHtml(purchase.credits)} szt.</td>
        <td>1</td>
        <td>${netValue} z\u0142</td>
        <td>${isVatExempt ? "ZW" : `${vatRate}%`}</td>
        <td>${amountGrossPln.toFixed(2)} z\u0142</td>
      </tr>
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Netto:</span> <span>${netValue} z\u0142</span></div>
    <div class="row"><span>VAT (${isVatExempt ? "ZW" : `${vatRate}%`}):</span> <span>${vatValue} z\u0142</span></div>
    <div class="row total"><span>Do zap\u0142aty:</span> <span>${amountGrossPln.toFixed(2)} z\u0142</span></div>
  </div>
  <div class="footer">
    <p>Dokument wygenerowany automatycznie przez system ${escapeHtml(seller.company_name)}.</p>
    <p>Sprzedawca korzysta ze zwolnienia podmiotowego z VAT (art. 113 ust. 1 i 9 ustawy o VAT).</p>
    <p>Status: ${purchase.status === "completed" ? "OP\u0141ACONE" : escapeHtml(String(purchase.status).toUpperCase())}</p>
  </div>
</body>
</html>`;
};

const normalizeCouponCode = (value: string) => value.trim().replace(/\s+/g, "").toUpperCase();

const resolveDiscount = async (couponCode: string | undefined, baseAmount: number) => {
  return resolveLocalCouponDiscount(couponCode, baseAmount);
};

billingRouter.post("/billing/coupons/preview", requireAuthenticatedUser, billingCouponPreviewRateLimit, async (request, response) => {
  try {
    const { couponCode } = request.body as CouponPreviewBody;
    const normalizedCouponCode = normalizeCouponCode(couponCode || "");
    const packages = (await listLocalCreditPackages({ activeOnly: true })) as CreditPackage[];

    const previews = await Promise.all(
      packages.map(async (pack) => {
        const discount = normalizedCouponCode
          ? await resolveDiscount(normalizedCouponCode, pack.price_grosze)
          : {
              matched: false,
              discountAmount: 0,
              finalAmount: pack.price_grosze,
              matchedCode: undefined,
            };

        return {
          packageId: pack.id,
          matched: Boolean(discount.matched),
          matchedCode: discount.matchedCode || null,
          originalAmount: pack.price_grosze,
          discountAmount: Math.max(0, Number(discount.discountAmount || 0)),
          finalAmount: Math.max(0, Number(discount.finalAmount || pack.price_grosze)),
        };
      })
    );

    response.json({
      ok: true,
      couponCode: normalizedCouponCode,
      matchedAny: previews.some((item) => item.matched),
      packages: previews,
    });
  } catch (error) {
    console.error("VPS coupon preview error:", error);
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie sprawdzic kuponu.",
    });
  }
});

const addCreditsForPaidSession = async (
  sessionId: string,
  userId: string,
  credits: number,
  paidAmount?: number | null
) => {
  void credits;
  const result = await completeLocalCreditPurchase(sessionId, paidAmount ?? null);
  if (!result.purchase || result.purchase.user_id !== userId) {
    return {
      applied: false,
      purchase: null,
    };
  }

  return {
    applied: result.applied,
    purchase: result.purchase,
  };
};

const resolvePackageIdForPurchase = async (purchase: CreditPurchaseRow | null | undefined) => {
  if (!purchase) return null;
  const packages = await listLocalCreditPackages();
  const fullMatch = packages.find(
    (pack) => Number(pack.credits) === Number(purchase.credits) && Number(pack.price_grosze) === Number(purchase.amount)
  );
  if (fullMatch?.id) return fullMatch.id;

  const creditsMatch = packages.find((pack) => Number(pack.credits) === Number(purchase.credits));
  return creditsMatch?.id || null;
};

const isCompanyInvoicePurchase = (purchase: CreditPurchaseRow | null | undefined) => {
  if (!purchase) return false;
  if (String(purchase.billing_type || "").toLowerCase() !== "company") return false;
  if (!String(purchase.billing_company || "").trim()) return false;
  if (!String(purchase.billing_nip || "").trim()) return false;
  return true;
};

const VAT_EXEMPT_LEGAL_BASIS = "Art. 113 ust. 1 i 9 ustawy o VAT";

const autoSendPurchaseToKsef = async (input: {
  purchase: CreditPurchaseRow | null;
  source: "verify" | "webhook";
  userEmail?: string | null;
}) => {
  const purchase = input.purchase;
  if (!purchase) return;
  if (!isCompanyInvoicePurchase(purchase)) return;
  if (String(purchase.ksef_reference_number || "").trim()) {
    console.log(`[ksef:auto:${input.source}] skipped, already sent`, {
      purchaseId: purchase.id,
      invoiceReferenceNumber: purchase.ksef_reference_number,
    });
    return;
  }

  try {
    const ksefSettings = await getLocalSettingsMap(["ksef_enabled", "ksef_token", "ksef_nip", "ksef_environment"]);
    const ksefEnabledValue = String(ksefSettings.ksef_enabled || "true").toLowerCase();
    const ksefEnabled = !["false", "0", "off", "no"].includes(ksefEnabledValue);
    if (!ksefEnabled) {
      console.log(`[ksef:auto:${input.source}] skipped, disabled in admin settings`, { purchaseId: purchase?.id });
      return;
    }

    const ksefToken = String(ksefSettings.ksef_token || env.ksefApiToken || "").trim();
    const ksefNip = String(ksefSettings.ksef_nip || env.ksefNip || "").trim();
    const ksefEnvironment = String(ksefSettings.ksef_environment || env.ksefEnvironment || "demo").trim();

    if (!ksefToken || !ksefNip) {
      console.error(`[ksef:auto:${input.source}] skipped, missing config`, {
        purchaseId: purchase.id,
        missingToken: !ksefToken,
        missingNip: !ksefNip,
      });
      return;
    }

    const [profile, sellerData] = await Promise.all([
      getLocalProfile(purchase.user_id).catch(() => null),
      getLocalInvoiceSettings({ ensureDefault: true }),
    ]);

    const amountGross = Number(purchase.paid_amount != null ? purchase.paid_amount : purchase.amount);
    const amountGrossPLN = amountGross / 100;
    const netPrice = amountGrossPLN;
    const createdAt = purchase.created_at || new Date().toISOString();
    const invoiceDate = new Date(createdAt);

    if (Number.isNaN(invoiceDate.getTime())) {
      console.error(`[ksef:auto:${input.source}] skipped, invalid purchase date`, {
        purchaseId: purchase.id,
        createdAt,
      });
      return;
    }

    const dateStr = invoiceDate.toISOString().split("T")[0];
    const invoiceNumber = [
      "FV",
      String(invoiceDate.getFullYear()),
      String(invoiceDate.getMonth() + 1).padStart(2, "0"),
      purchase.id.slice(0, 8).toUpperCase(),
    ].join("/");

    const buyerEmail = String(input.userEmail || profile?.email || "").trim() || undefined;

    const result = await sendInvoiceToKsef({
      token: ksefToken,
      nip: ksefNip,
      environment: ksefEnvironment,
      logger: (step, details) => {
        if (details === undefined) {
          console.log(`[ksef:auto:${input.source}] ${step}`);
        } else {
          console.log(`[ksef:auto:${input.source}] ${step}`, details);
        }
      },
      invoice: {
        invoiceNumber,
        issueDate: dateStr,
        salesDate: dateStr,
        seller: {
          nip: ksefNip,
          name: sellerData?.company_name || "Kreator AI",
          address: sellerData?.address || "",
          postalCode: sellerData?.postal_code || "",
          city: sellerData?.city || "",
        },
        buyer: {
          name: purchase.billing_company || purchase.billing_name || profile?.display_name || profile?.email || "Nabywca",
          nip: purchase.billing_nip || undefined,
          address: sanitizeBuyerAddress(purchase.billing_address, purchase.billing_nip) || undefined,
          postalCode: purchase.billing_postal_code || undefined,
          city: purchase.billing_city || undefined,
          email: buyerEmail,
        },
        items: [
          {
            name: `Pakiet kredytow - ${purchase.credits} szt.`,
            quantity: 1,
            unitPrice: Number(netPrice.toFixed(2)),
            vatRate: "zw",
          },
        ],
        currency: "PLN",
        vatExemptionLegalBasis: VAT_EXEMPT_LEGAL_BASIS,
      },
    });

    await updateLocalCreditPurchase(purchase.id, {
      ksef_reference_number: result.invoiceReferenceNumber || null,
      ksef_invoice_number: result.invoiceNumber || null,
      ksef_session_reference_number: result.sessionReferenceNumber || null,
      ksef_environment: result.environment || ksefEnvironment,
      ksef_sent_at: new Date().toISOString(),
      ksef_error: null,
      updated_at: new Date().toISOString(),
    });

    console.log(`[ksef:auto:${input.source}] sent`, {
      purchaseId: purchase.id,
      invoiceReferenceNumber: result.invoiceReferenceNumber,
      invoiceNumber: result.invoiceNumber,
      environment: result.environment,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await updateLocalCreditPurchase(purchase.id, {
      ksef_error: errorMessage,
      updated_at: new Date().toISOString(),
    }).catch(() => null);
    console.error(`[ksef:auto:${input.source}] failed`, {
      purchaseId: purchase.id,
      error: errorMessage,
    });
  }
};

billingRouter.get("/billing/credits/overview", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const [packages, purchases, usage] = await Promise.all([
      listLocalCreditPackages({ activeOnly: true }),
      listLocalCreditPurchases({ userId: user.id, limit: 20 }),
      listLocalCreditUsage({ userId: user.id, limit: 20 }),
    ]);

    response.json({
      ok: true,
      packages: packages as CreditPackage[],
      purchases: purchases as CreditPurchase[],
      usage: usage as CreditUsage[],
    });
  } catch (error) {
    console.error("VPS credits overview error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie pobrac danych kredytow.",
    });
  }
});

billingRouter.post("/billing/checkout", requireAuthenticatedUser, billingCheckoutRateLimit, async (request, response) => {
  let createdPurchase: CreditPurchaseRow | null = null;

  try {
    const { packageId, couponCode, origin, billing } = request.body as CheckoutBody;
    const user = request.authUser!;

    if (!packageId) {
      response.status(400).json({ ok: false, error: "Brak pakietu kredytow." });
      return;
    }

    const pack = await getLocalCreditPackageById(packageId);

    if (!pack || !pack.active) {
      response.status(400).json({ ok: false, error: "Nieprawidlowy albo nieaktywny pakiet." });
      return;
    }

    const selectedPackage = pack as CreditPackage;
    const normalizedCouponCode = normalizeCouponCode(couponCode || "");
    const discount = await resolveDiscount(normalizedCouponCode, selectedPackage.price_grosze);
    if (couponCode?.trim() && !discount.matched) {
      response.status(400).json({ ok: false, error: "Nie znaleziono aktywnego kodu rabatowego." });
      return;
    }
    if (discount.finalAmount < 1) {
      response.status(400).json({ ok: false, error: "Rabat nie moze obnizyc ceny ponizej 0,01 zl." });
      return;
    }

    const normalizedBilling = normalizeCheckoutBilling(billing);

    const purchaseSessionId = randomUUID();

    const insertData: Partial<CreditPurchaseRow> = {
      user_id: user.id,
      amount: selectedPackage.price_grosze,
      credits: selectedPackage.credits,
      status: "pending",
      payment_provider: getConfiguredPaymentProvider(),
      payment_session_id: purchaseSessionId,
      stripe_session_id: purchaseSessionId,
    };

    insertData.billing_type = normalizedBilling.type;
    insertData.billing_name = normalizedBilling.name;
    insertData.billing_nip = normalizedBilling.nip;
    insertData.billing_company = normalizedBilling.company;
    insertData.billing_address = normalizedBilling.address;
    insertData.billing_postal_code = normalizedBilling.postalCode;
    insertData.billing_city = normalizedBilling.city;

    createdPurchase = await createLocalCreditPurchase(insertData);
    if (!createdPurchase) {
      throw new Error("Nie udalo sie zapisac lokalnego zakupu.");
    }

    const continueUrl = buildSuccessUrl(origin, purchaseSessionId);
    const buyerNameSource = String(
      normalizedBilling.name ||
        normalizedBilling.company ||
        user.email ||
        "Klient"
    ).trim() || "Klient";
    const [firstNamePart, ...lastNameParts] = buyerNameSource.split(/\s+/).filter(Boolean);
    const firstName = firstNamePart || "Klient";
    const lastName = lastNameParts.join(" ") || "Kreator";

    const payment = await createCheckoutPayment({
      notifyUrl: `${env.apiUrl}${getPaymentWebhookPath()}`,
      continueUrl,
      customerIp: getRequestClientIp({ headers: request.headers as Record<string, unknown>, ip: request.ip }),
      description: `${selectedPackage.label} - ${selectedPackage.credits} kredytow`,
      currencyCode: "PLN",
      totalAmount: String(Math.round(discount.finalAmount)),
      externalSessionId: purchaseSessionId,
      buyer: {
        email: String(user.email || "").trim() || undefined,
        language: "pl",
        firstName,
        lastName,
      },
      products: [
        {
          name: `${selectedPackage.label} - ${selectedPackage.credits} kredytow`,
          unitPrice: String(Math.round(discount.finalAmount)),
          quantity: "1",
        },
      ],
    });

    await updateLocalCreditPurchase(createdPurchase.id, {
      payment_provider: payment.provider,
      payment_order_id: payment.externalPaymentId || null,
      payu_order_id: payment.provider === "payu" ? payment.externalPaymentId || null : null,
      updated_at: new Date().toISOString(),
    });

    response.json({
      ok: true,
      url: payment.redirectUrl || null,
      provider: payment.provider,
      providerLabel: payment.providerLabel,
    });
  } catch (error) {
    if (createdPurchase) {
      await updateLocalCreditPurchase(createdPurchase.id, {
        status: "failed",
        updated_at: new Date().toISOString(),
      }).catch(() => null);
    }

    console.error("VPS checkout error:", error);
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad podczas tworzenia platnosci.",
    });
  }
});

billingRouter.post("/billing/payments/verify", requireAuthenticatedUser, billingVerifyRateLimit, async (request, response) => {
  try {
    const { sessionId } = request.body as VerifyPaymentBody;
    const user = request.authUser!;

    if (!sessionId) {
      response.status(400).json({ ok: false, error: "Brak ID sesji platnosci." });
      return;
    }

    const existingPurchase = await getLocalCreditPurchaseByPaymentSessionId(sessionId);
    if (!existingPurchase) {
      response.status(404).json({ ok: false, error: "Nie znaleziono zakupu dla tej sesji." });
      return;
    }
    if (existingPurchase.user_id !== user.id) {
      response.status(403).json({ ok: false, error: "Sesja platnosci nie nalezy do tego uzytkownika." });
      return;
    }

    if (existingPurchase.status === "completed") {
      try {
        const packageId = await resolvePackageIdForPurchase(existingPurchase);
        await subscribePurchaseToMailerLite({
          packageId,
          userId: user.id,
          email: user.email,
        });
      } catch (error) {
        console.error("VPS verify payment mailerlite sync error:", error);
      }

      response.json({ ok: true, status: "already_completed", credits: existingPurchase.credits });
      return;
    }

    const orderId = String(existingPurchase.payment_order_id || existingPurchase.payu_order_id || "").trim();
    if (!orderId) {
      response.json({ ok: true, status: "not_paid", payment_status: existingPurchase.status });
      return;
    }

    const paymentStatus = await getCheckoutPaymentStatus(orderId);
    const normalizedPaymentStatus = String(paymentStatus.paymentStatus || "").toUpperCase();
    if (normalizedPaymentStatus !== "COMPLETED") {
      response.json({ ok: true, status: "not_paid", payment_status: normalizedPaymentStatus || "PENDING" });
      return;
    }

    const credits = Number(existingPurchase.credits || 0);
    if (!credits) {
      response.status(400).json({ ok: false, error: "Brak kredytow przypisanych do zakupu." });
      return;
    }

    const completion = await addCreditsForPaidSession(sessionId, user.id, credits, paymentStatus.totalAmount);
    const packageId = await resolvePackageIdForPurchase(completion.purchase || existingPurchase);
    await subscribePurchaseToMailerLite({
      packageId,
      userId: user.id,
      email: user.email,
    });
    if (completion.applied) {
      await autoSendPurchaseToKsef({
        purchase: completion.purchase,
        source: "verify",
        userEmail: user.email,
      });
    }

    response.json({ ok: true, status: "completed", credits });
  } catch (error) {
    console.error("VPS verify payment error:", error);
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie zweryfikowac platnosci.",
    });
  }
});

billingRouter.post(["/billing/payment-webhook", "/billing/payu-webhook", "/billing/tpay-webhook"], async (request, response) => {
  try {
    const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from(JSON.stringify(request.body));
    const webhookPayment = await parsePaymentWebhook(rawBody, {
      signature: request.header("openpayu-signature") || request.header("OpenPayu-Signature"),
      jwsSignature: request.header("x-jws-signature") || request.header("X-JWS-Signature"),
    });

    const sendWebhookAck = (ignored = false) => {
      if (webhookPayment.provider === "tpay") {
        response.type("text/plain").send("TRUE");
        return;
      }
      response.json(ignored ? { received: true, ignored: true } : { received: true });
    };

    let purchase = webhookPayment.externalSessionId
      ? await getLocalCreditPurchaseByPaymentSessionId(webhookPayment.externalSessionId)
      : null;

    if (!purchase && webhookPayment.externalPaymentId) {
      purchase = await getLocalCreditPurchaseByPaymentOrderId(webhookPayment.externalPaymentId);
    }

    if (!purchase) {
      sendWebhookAck(true);
      return;
    }

    if (
      webhookPayment.externalPaymentId &&
      String(purchase.payment_order_id || purchase.payu_order_id || "").trim() !== webhookPayment.externalPaymentId
    ) {
      purchase = await updateLocalCreditPurchase(purchase.id, {
        payment_provider: webhookPayment.provider,
        payment_order_id: webhookPayment.externalPaymentId,
        payu_order_id: webhookPayment.provider === "payu" ? webhookPayment.externalPaymentId : purchase.payu_order_id,
        updated_at: new Date().toISOString(),
      });
    }

    if (webhookPayment.paymentStatus !== "COMPLETED") {
      sendWebhookAck();
      return;
    }

    const sessionId = String(purchase?.payment_session_id || purchase?.stripe_session_id || "").trim();
    if (!sessionId || !purchase) {
      response.status(400).send("Missing local purchase session");
      return;
    }

    const credits = Number(purchase.credits || 0);
    const completion = await addCreditsForPaidSession(sessionId, purchase.user_id, credits, webhookPayment.paidAmount);
    const packageId = await resolvePackageIdForPurchase(completion.purchase || purchase);
    await subscribePurchaseToMailerLite({
      packageId,
      userId: purchase.user_id,
    });
    if (completion.applied) {
      await autoSendPurchaseToKsef({
        purchase: completion.purchase,
        source: "webhook",
      });
    }

    sendWebhookAck();
  } catch (error) {
    console.error("VPS payment webhook error:", error);
    if (getConfiguredPaymentProvider() === "tpay") {
      response.status(400).type("text/plain").send("FALSE");
      return;
    }
    response.status(400).send(error instanceof Error ? error.message : "Invalid webhook");
  }
});

billingRouter.post("/billing/invoices/generate", requireAuthenticatedUser, billingInvoiceGenerateRateLimit, async (request, response) => {
  try {
    const { purchaseId } = request.body as GenerateInvoiceBody;
    const user = request.authUser!;

    if (!purchaseId) {
      response.status(400).json({ ok: false, error: "Brak ID zakupu." });
      return;
    }

    const html = await generateInvoiceHtml(purchaseId, user.id);
    response.json({ ok: true, html });
  } catch (error) {
    console.error("VPS invoice generation error:", error);
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie wygenerowac faktury.",
    });
  }
});
billingRouter.post("/billing/ksef/send", todoRoute({ scope: "billing", action: "send invoice to KSeF" }));
