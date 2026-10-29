import { randomUUID } from "node:crypto";
import { getLocalSettingsMap, upsertLocalSiteSettingsRows } from "./localCoreData.js";
import { cappedCouponDiscount, MAX_COUPON_DISCOUNT_PERCENT } from './couponLimits.js';

const STORAGE_KEY = "billing_coupons_v1";

export type LocalPromoCode = {
  id: string;
  code: string;
  active: boolean;
  times_redeemed: number;
  max_redemptions: number | null;
};

export type LocalCoupon = {
  id: string;
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  valid: boolean;
  times_redeemed: number;
  created: number;
  promotion_codes: LocalPromoCode[];
};

type StoredCoupons = {
  coupons: LocalCoupon[];
};

export type CouponDiscountMatch = {
  matched: boolean;
  discountAmount: number;
  finalAmount: number;
  couponId?: string;
  promoId?: string;
  matchedCode?: string;
};

const normalizeDiscountLookup = (value: string) => value.trim().toUpperCase().replace(/[\s\-_]+/g, "");

const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");

const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const normalizePromoCode = (promo: Partial<LocalPromoCode>): LocalPromoCode => ({
  id: String(promo.id || randomUUID()),
  code: normalizeCode(String(promo.code || "")),
  active: promo.active ?? true,
  times_redeemed: toPositiveInteger(promo.times_redeemed),
  max_redemptions: promo.max_redemptions == null ? null : toPositiveInteger(promo.max_redemptions),
});

const normalizeCoupon = (coupon: Partial<LocalCoupon>): LocalCoupon => {
  const percent = coupon.percent_off == null ? null : Number(coupon.percent_off);
  const amountOff = coupon.amount_off == null ? null : Number(coupon.amount_off);

  return {
    id: String(coupon.id || randomUUID()),
    name: coupon.name == null ? null : String(coupon.name),
    percent_off: Number.isFinite(percent) && (percent as number) > 0 ? Math.min(MAX_COUPON_DISCOUNT_PERCENT, Number(percent)) : null,
    amount_off: Number.isFinite(amountOff) && (amountOff as number) > 0 ? Math.floor(Number(amountOff)) : null,
    currency: coupon.currency == null ? "pln" : String(coupon.currency).toLowerCase(),
    duration: coupon.duration ? String(coupon.duration) : "once",
    valid: coupon.valid ?? true,
    times_redeemed: toPositiveInteger(coupon.times_redeemed),
    created: toPositiveInteger(coupon.created) || Math.floor(Date.now() / 1000),
    promotion_codes: Array.isArray(coupon.promotion_codes)
      ? coupon.promotion_codes.map(normalizePromoCode).filter((item) => item.code)
      : [],
  };
};

const dedupePromotionCodes = (promotionCodes: LocalPromoCode[]) => {
  const seen = new Set<string>();
  const result: LocalPromoCode[] = [];

  for (const code of promotionCodes) {
    const normalized = normalizeDiscountLookup(code.code);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(code);
  }

  return result;
};

const normalizeCouponsList = (coupons: LocalCoupon[]) => {
  return coupons.map(normalizeCoupon).map((coupon) => ({
    ...coupon,
    promotion_codes: dedupePromotionCodes(coupon.promotion_codes),
  }));
};

const safeParseCoupons = (rawValue: string | undefined): LocalCoupon[] => {
  if (!rawValue?.trim()) return [];

  try {
    const parsed = JSON.parse(rawValue) as StoredCoupons | LocalCoupon[] | null;
    if (Array.isArray(parsed)) {
      return normalizeCouponsList(parsed);
    }
    if (parsed && Array.isArray(parsed.coupons)) {
      return normalizeCouponsList(parsed.coupons);
    }
  } catch {
    // ignore invalid payload and reset to empty list
  }

  return [];
};

const persistCoupons = async (coupons: LocalCoupon[]) => {
  const payload: StoredCoupons = {
    coupons: normalizeCouponsList(coupons),
  };

  await upsertLocalSiteSettingsRows([
    {
      key: STORAGE_KEY,
      value: JSON.stringify(payload),
      updated_at: new Date().toISOString(),
    },
  ]);
};

export const listLocalCoupons = async (): Promise<LocalCoupon[]> => {
  const settings = await getLocalSettingsMap([STORAGE_KEY]);
  const coupons = safeParseCoupons(settings[STORAGE_KEY]);
  return coupons.sort((left, right) => right.created - left.created);
};

export const createLocalCoupon = async (input: {
  name?: string;
  percentOff?: number;
  amountOff?: number;
}) => {
  const percent = Number(input.percentOff);
  const amount = Number(input.amountOff);

  const hasPercent = Number.isFinite(percent) && percent > 0;
  const hasAmount = Number.isFinite(amount) && amount > 0;
  if (!hasPercent && !hasAmount) {
    throw new Error("Podaj procent lub kwote rabatu.");
  }

  if (hasPercent && percent > MAX_COUPON_DISCOUNT_PERCENT) {
    throw new Error("Maksymalny rabat wynosi 20%.");
  }

  const coupons = await listLocalCoupons();
  const coupon = normalizeCoupon({
    id: randomUUID(),
    name: input.name?.trim() || "Kupon rabatowy",
    percent_off: hasPercent ? percent : null,
    amount_off: hasAmount ? Math.round(amount) : null,
    currency: "pln",
    duration: "once",
    valid: true,
    times_redeemed: 0,
    created: Math.floor(Date.now() / 1000),
    promotion_codes: [],
  });

  coupons.push(coupon);
  await persistCoupons(coupons);
  return coupon;
};

export const createLocalPromoCode = async (input: { couponId: string; code: string }) => {
  const requestedCode = normalizeCode(input.code);
  if (!requestedCode) {
    throw new Error("Kod promocyjny nie moze byc pusty.");
  }

  const coupons = await listLocalCoupons();
  const couponIndex = coupons.findIndex((coupon) => coupon.id === input.couponId);
  if (couponIndex < 0) {
    throw new Error("Nie znaleziono kuponu.");
  }

  const normalizedLookup = normalizeDiscountLookup(requestedCode);
  const duplicateExists = coupons.some((coupon) =>
    coupon.promotion_codes.some((promotionCode) => normalizeDiscountLookup(promotionCode.code) === normalizedLookup)
  );

  if (duplicateExists) {
    throw new Error("Taki kod promocyjny juz istnieje.");
  }

  const promoCode = normalizePromoCode({
    id: randomUUID(),
    code: requestedCode,
    active: true,
    times_redeemed: 0,
    max_redemptions: null,
  });

  coupons[couponIndex] = {
    ...coupons[couponIndex],
    promotion_codes: [...coupons[couponIndex].promotion_codes, promoCode],
  };

  await persistCoupons(coupons);
  return promoCode;
};

export const deactivateLocalPromoCode = async (promoId: string) => {
  const coupons = await listLocalCoupons();
  let changed = false;

  const nextCoupons = coupons.map((coupon) => {
    const nextCodes = coupon.promotion_codes.map((promotionCode) => {
      if (promotionCode.id !== promoId) return promotionCode;
      changed = true;
      return {
        ...promotionCode,
        active: false,
      };
    });
    return {
      ...coupon,
      promotion_codes: nextCodes,
    };
  });

  if (!changed) {
    throw new Error("Nie znaleziono kodu promocyjnego.");
  }

  await persistCoupons(nextCoupons);
};

export const deleteLocalCoupon = async (couponId: string) => {
  const coupons = await listLocalCoupons();
  const nextCoupons = coupons.filter((coupon) => coupon.id !== couponId);

  if (nextCoupons.length === coupons.length) {
    throw new Error("Nie znaleziono kuponu.");
  }

  await persistCoupons(nextCoupons);
};

export const resolveLocalCouponDiscount = async (
  couponCode: string | undefined,
  baseAmount: number
): Promise<CouponDiscountMatch> => {
  const requestedCode = normalizeCode(String(couponCode || ""));
  if (!requestedCode) {
    return {
      matched: false,
      discountAmount: 0,
      finalAmount: baseAmount,
    };
  }

  const requestedLookup = normalizeDiscountLookup(requestedCode);
  const coupons = await listLocalCoupons();

  for (const coupon of coupons) {
    if (!coupon.valid) continue;

    const promo = coupon.promotion_codes.find((promotionCode) => {
      if (!promotionCode.active) return false;
      return normalizeDiscountLookup(promotionCode.code) === requestedLookup;
    });

    if (!promo) continue;

    const discountAmount = cappedCouponDiscount(baseAmount, coupon.percent_off, coupon.amount_off);

    const finalAmount = Math.max(0, baseAmount - discountAmount);
    return {
      matched: true,
      discountAmount: Math.max(0, discountAmount),
      finalAmount,
      couponId: coupon.id,
      promoId: promo.id,
      matchedCode: promo.code,
    };
  }

  return {
    matched: false,
    discountAmount: 0,
    finalAmount: baseAmount,
  };
};
