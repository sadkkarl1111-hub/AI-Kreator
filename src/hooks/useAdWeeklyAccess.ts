import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { vpsFetch } from '@/lib/vpsApi';
import type { AdQuota } from '@/lib/adQuota';
import type { AdPromptResult } from '@/pages/AdPromptGenerator';
type Access = { campaign: AdQuota; research: AdQuota; lastSession?: { id: string; inputText: string; prompts: AdPromptResult[]; createdAt: string } | null };
export function useAdWeeklyAccess() {
  const { user } = useAuth(); const owner = user?.id;
  const [state, setState] = useState<{ owner?: string; data?: Access; error?: string; loading?: boolean }>({ loading: true });
  const job = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++job.current;
    if (!owner) { setState({}); return; }
    try {
      const data = await vpsFetch<Access>('/ad-generator/access', undefined, { retryAuthOnly: true });
      if (!data.campaign || typeof data.campaign.remaining !== 'number' || !data.research) throw new Error('Nie udało się odczytać limitu.');
      if (job.current === current) setState({ owner, data });
    } catch (error) { if (job.current === current) setState({ owner, error: error instanceof Error ? error.message : 'Nie udało się sprawdzić limitu.' }); }
  }, [owner]);
  useEffect(() => {
    const tracker = job;
    let active = true; queueMicrotask(() => { if (active) void refresh(); });
    const focus = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(focus, 60000); window.addEventListener('focus', focus);
    return () => { active = false; tracker.current++; window.clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [refresh]);
  return { userId: owner, data: state.owner === owner ? state.data : undefined, error: state.owner === owner ? state.error : undefined, loading: Boolean(owner && (state.owner !== owner || state.loading)), refresh };
}
