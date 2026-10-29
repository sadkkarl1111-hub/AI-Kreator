import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { vpsFetch } from '@/lib/vpsApi';

export type CarouselGeneratorAccess = {
  allowed: boolean;
  isAdmin: boolean;
  balance: number;
  models: { id: string; label: string; cost: number }[];
};

export function useCarouselGeneratorAccess() {
  const { user, loading: authLoading } = useAuth();
  const owner = user?.id;
  const [status, setStatus] = useState<{ owner?: string; data?: CarouselGeneratorAccess; error?: string; loading?: boolean }>({ loading: true });
  const job = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++job.current;
    if (!owner) { setStatus({}); return; }
    setStatus({ owner, loading: true });
    try {
      const data = await vpsFetch<CarouselGeneratorAccess>('/ai/carousel-generator', undefined, { retryAuthOnly: true });
      if (job.current === current) setStatus({ owner, data });
    } catch (reason) {
      if (job.current === current) setStatus({ owner, error: reason instanceof Error ? reason.message : 'Nie udało się sprawdzić dostępu.' });
    }
  }, [owner]);
  useEffect(() => {
    let active = true;
    const requests = job;
    queueMicrotask(() => { if (active) void refresh(); });
    return () => { active = false; requests.current++; };
  }, [refresh]);
  // Never expose the preceding account's entitlement while the effect is resetting.
  return {
    userId: owner,
    data: status.owner === owner ? status.data : undefined,
    error: status.owner === owner ? status.error : undefined,
    loading: authLoading || Boolean(owner && (status.owner !== owner || status.loading)),
    refresh,
  };
}
