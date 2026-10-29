import { env } from "../config/env.js";
import {
  createPayuOrder,
  getPayuOrderStatus,
  testPayuConnection,
  verifyPayuWebhookSignature,
} from "./payu.js";
import {
  createTpayTransaction,
  getTpayTransactionStatus,
  parseTpayWebhook,
  testTpayConnection,
} from "./tpay.js";

export type PaymentProviderName = "payu" | "tpay";

type CheckoutPaymentInput = {
  notifyUrl: string;
  continueUrl: string;
  customerIp: string;
  description: string;
  currencyCode: string;
  totalAmount: string;
  externalSessionId: string;
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

type CheckoutPaymentResult = {
  provider: PaymentProviderName;
  providerLabel: string;
  externalPaymentId: string;
  redirectUrl: string | null;
};

type CheckoutPaymentStatus = {
  provider: PaymentProviderName;
  providerLabel: string;
  externalPaymentId: string | null;
  paymentStatus: string | null;
  totalAmount: number | null;
  currencyCode: string | null;
};

type ParsedPaymentWebhook = {
  provider: PaymentProviderName;
  providerLabel: string;
  externalPaymentId: string | null;
  externalSessionId: string;
  paymentStatus: string;
  paidAmount: number | null;
  providerReferenceId?: string | null;
};

const normalizePaymentProvider = (value: string | undefined): PaymentProviderName => {
  return String(value || "")
    .trim()
    .toLowerCase() === "tpay"
    ? "tpay"
    : "payu";
};

export const getConfiguredPaymentProvider = (): PaymentProviderName => {
  return normalizePaymentProvider(env.paymentProvider);
};

export const getPaymentProviderLabel = (provider = getConfiguredPaymentProvider()) => {
  return provider === "tpay" ? "Tpay" : "PayU";
};

export const getPaymentWebhookPath = () => "/billing/payment-webhook";

export const createCheckoutPayment = async (
  input: CheckoutPaymentInput
): Promise<CheckoutPaymentResult> => {
  const provider = getConfiguredPaymentProvider();

  if (provider === "tpay") {
    const transaction = await createTpayTransaction({
      notifyUrl: input.notifyUrl,
      continueUrl: input.continueUrl,
      customerIp: input.customerIp,
      description: input.description,
      totalAmount: input.totalAmount,
      externalSessionId: input.externalSessionId,
      buyer: input.buyer,
    });

    return {
      provider,
      providerLabel: getPaymentProviderLabel(provider),
      externalPaymentId: transaction.transactionId,
      redirectUrl: transaction.redirectUrl,
    };
  }

  const order = await createPayuOrder({
    notifyUrl: input.notifyUrl,
    continueUrl: input.continueUrl,
    customerIp: input.customerIp,
    merchantPosId: env.payuPosId,
    description: input.description,
    currencyCode: input.currencyCode,
    totalAmount: input.totalAmount,
    extOrderId: input.externalSessionId,
    buyer: input.buyer,
    products: input.products,
  });

  return {
    provider,
    providerLabel: getPaymentProviderLabel(provider),
    externalPaymentId: String(order.orderId || "").trim(),
    redirectUrl: order.redirectUri || null,
  };
};

export const getCheckoutPaymentStatus = async (
  externalPaymentId: string
): Promise<CheckoutPaymentStatus> => {
  const provider = getConfiguredPaymentProvider();

  if (provider === "tpay") {
    const payment = await getTpayTransactionStatus(externalPaymentId);

    return {
      provider,
      providerLabel: getPaymentProviderLabel(provider),
      externalPaymentId: payment.transactionId,
      paymentStatus: payment.paymentStatus,
      totalAmount: payment.totalAmount,
      currencyCode: payment.currencyCode,
    };
  }

  const payment = await getPayuOrderStatus(externalPaymentId);

  return {
    provider,
    providerLabel: getPaymentProviderLabel(provider),
    externalPaymentId: payment.orderId,
    paymentStatus: payment.paymentStatus,
    totalAmount: payment.totalAmount,
    currencyCode: payment.currencyCode,
  };
};

export const parsePaymentWebhook = (
  rawBody: Buffer,
  headers: { signature?: string | undefined; jwsSignature?: string | undefined }
): Promise<ParsedPaymentWebhook> | ParsedPaymentWebhook => {
  const provider = getConfiguredPaymentProvider();

  if (provider === "tpay") {
    return parseTpayWebhook(rawBody, headers.jwsSignature).then((payload) => ({
      provider,
      providerLabel: getPaymentProviderLabel(provider),
      externalPaymentId: payload.externalPaymentId,
      externalSessionId: payload.externalSessionId,
      paymentStatus: payload.paymentStatus,
      paidAmount: payload.paidAmount,
      providerReferenceId: payload.providerReferenceId,
    }));
  }

  verifyPayuWebhookSignature(rawBody, headers.signature);

  const payload = JSON.parse(rawBody.toString("utf8")) as {
    order?: {
      orderId?: string;
      extOrderId?: string;
      status?: string;
      totalAmount?: string;
    };
  };

  const externalPaymentId = String(payload.order?.orderId || "").trim();
  const externalSessionId = String(payload.order?.extOrderId || "").trim();

  if (!externalPaymentId || !externalSessionId) {
    throw new Error("Brak identyfikatorow platnosci w webhooku operatora.");
  }

  return {
    provider,
    providerLabel: getPaymentProviderLabel(provider),
    externalPaymentId,
    externalSessionId,
    paymentStatus: String(payload.order?.status || "").trim().toUpperCase(),
    paidAmount: payload.order?.totalAmount ? Number(payload.order.totalAmount) : null,
  };
};

export const testPaymentConnection = async () => {
  const provider = getConfiguredPaymentProvider();

  if (provider === "tpay") {
    const connection = await testTpayConnection();

    return {
      provider,
      providerLabel: getPaymentProviderLabel(provider),
      accountId: `Merchant ${connection.merchantId}`,
      baseUrl: connection.baseUrl,
    };
  }

  const connection = await testPayuConnection();

  return {
    provider,
    providerLabel: getPaymentProviderLabel(provider),
    accountId: `POS ${connection.posId}`,
    baseUrl: connection.baseUrl,
  };
};
