import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { env } from '../config/env.js';
import { getPostgresPool } from './postgres.js';

export type AdQuotaScope = 'campaign' | 'research';
export const AD_QUOTA_DAYS = 7;
export type AdQuota = { remaining: number; nextAvailableAt: string | null; limit: number; windowDays: number };

export function normalizeAdIp(value: string) {
  let address = value.trim().toLowerCase();
  if (address.startsWith('::ffff:') && isIP(address.slice(7)) === 4) address = address.slice(7);
  if (!isIP(address)) throw new Error('Nie udało się ustalić adresu IP.');
  return isIP(address) === 6 ? new URL(`http://[${address}]/`).hostname.slice(1, -1) : address;
}
export function adQuotaSubjects(request: Request) {
  // Apache appends the actual connecting client last. Never trust a supplied first entry.
  const forwarded = request.header('x-forwarded-for')?.split(',').at(-1)?.trim();
  const ip = normalizeAdIp(forwarded || request.socket.remoteAddress || '');
  const hash = (kind: string, value: string) => createHmac('sha256', env.jwtRefreshSecret).update(`ad-weekly-v1:${kind}:${value}`).digest('hex');
  if (!request.authUser?.id) throw new Error('Wymagane logowanie.');
  return [hash('ip', ip), hash('account', request.authUser.id)].sort();
}

export function createAdWeeklyStore(pool: Pick<Pool, 'connect' | 'query'> = getPostgresPool()) {
  const status = async (scope: AdQuotaScope, subjects: string[]): Promise<AdQuota> => {
    const { rows } = await pool.query<{ next_at: Date | null }>(
      "SELECT max(used_at + interval '7 days') AS next_at FROM ad_ai_weekly_limits WHERE scope=$1 AND subject_key=ANY($2::text[]) AND used_at > now()-interval '7 days'", [scope, subjects]);
    return { remaining: rows[0]?.next_at ? 0 : 1, nextAvailableAt: rows[0]?.next_at?.toISOString() || null, limit: 1, windowDays: AD_QUOTA_DAYS };
  };
  const consume = async (scope: AdQuotaScope, subjects: string[]): Promise<AdQuota & { claimed: boolean }> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const keys = [...new Set(subjects)].sort();
      if (!keys.length) throw new Error('Brak identyfikatora limitu.');
      // Consistent lock order protects concurrent requests, accounts sharing an IP and multiple processes.
      for (const key of keys) await client.query('INSERT INTO ad_ai_weekly_limits(scope,subject_key) VALUES($1,$2) ON CONFLICT DO NOTHING', [scope, key]);
      const { rows } = await client.query<{ next_at: Date | null }>(
        "SELECT CASE WHEN used_at > now()-interval '7 days' THEN used_at+interval '7 days' ELSE NULL END AS next_at FROM ad_ai_weekly_limits WHERE scope=$1 AND subject_key=ANY($2::text[]) ORDER BY subject_key FOR UPDATE", [scope, keys]);
      const blocked = rows.map(row => row.next_at).filter((date): date is Date => Boolean(date)).sort((a, b) => b.getTime() - a.getTime())[0];
      if (blocked) { await client.query('ROLLBACK'); return { claimed: false, remaining: 0, nextAvailableAt: blocked.toISOString(), limit: 1, windowDays: AD_QUOTA_DAYS }; }
      const updated = await client.query<{ next_at: Date }>("UPDATE ad_ai_weekly_limits SET used_at=now() WHERE scope=$1 AND subject_key=ANY($2::text[]) RETURNING used_at+interval '7 days' AS next_at", [scope, keys]);
      await client.query('COMMIT');
      return { claimed: true, remaining: 0, nextAvailableAt: updated.rows[0].next_at.toISOString(), limit: 1, windowDays: AD_QUOTA_DAYS };
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { client.release(); }
  };
  return { status, consume };
}
// Lazy pool access keeps module imports usable without database configuration in tests.
export const adWeeklyStore = {
  status: (scope: AdQuotaScope, subjects: string[]) => createAdWeeklyStore().status(scope, subjects),
  consume: (scope: AdQuotaScope, subjects: string[]) => createAdWeeklyStore().consume(scope, subjects),
};
