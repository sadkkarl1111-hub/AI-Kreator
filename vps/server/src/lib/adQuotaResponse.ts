import type { Response } from 'express';
import type { AdQuota } from './adWeeklyAccess.js';
export function adQuotaBlocked(response: Response, quota: AdQuota) {
  const seconds = Math.max(1, Math.ceil((Date.parse(quota.nextAvailableAt || '') - Date.now()) / 1000) || 1);
  response.set('Retry-After', String(seconds));
  return response.status(429).json({ code: 'AD_WEEKLY_LIMIT', quota, error: `Wykorzystano bezpłatne generowanie na 7 dni dla tego adresu IP lub konta. Następna próba: ${new Date(quota.nextAvailableAt!).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}.` });
}
