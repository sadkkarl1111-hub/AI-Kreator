export type AdQuota = { remaining: number; nextAvailableAt: string | null; limit: number; windowDays: number; unlimited?: boolean };
export const adQuotaDate = (quota?: AdQuota) => quota?.nextAvailableAt ? new Date(quota.nextAvailableAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }) : '';
