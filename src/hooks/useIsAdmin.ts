import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { vpsFetch } from '@/lib/vpsApi';

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    vpsFetch<{ ok: boolean; isAdmin: boolean }>('/me')
      .then((data) => {
        setIsAdmin(!!data.isAdmin);
      })
      .catch(() => {
        setIsAdmin(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user, authLoading]);

  return { isAdmin, loading, user, authLoading };
}
