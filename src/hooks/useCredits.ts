import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { vpsFetch } from '@/lib/vpsApi';

export function useCredits() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!user) {
      setBalance(null);
      setIsAdmin(null);
      setLoading(false);
      return;
    }

    try {
      const data = await vpsFetch<{ ok: boolean; balance: number; isAdmin?: boolean }>('/me/credits');
      setBalance(data.balance ?? 0);
      setIsAdmin(typeof data.isAdmin === 'boolean' ? data.isAdmin : null);
    } catch {
      setBalance((previous) => previous ?? 0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, isAdmin, loading, refetch: fetchBalance };
}
