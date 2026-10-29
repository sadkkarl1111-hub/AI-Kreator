export const MAX_COUPON_DISCOUNT_PERCENT = 20;
export function cappedCouponDiscount(baseAmount: number, percentOff?: number | null, amountOff?: number | null) {
  const base = Math.max(0, Math.floor(baseAmount));
  const requested = percentOff && percentOff > 0 ? Math.round(base * percentOff / 100) : Math.max(0, Math.floor(amountOff || 0));
  return Math.min(requested, Math.floor(base * MAX_COUPON_DISCOUNT_PERCENT / 100));
}
