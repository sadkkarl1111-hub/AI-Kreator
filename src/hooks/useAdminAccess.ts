import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { resolveAllowedAdminTabs } from '@/lib/adminTabs';
import { vpsFetch } from '@/lib/vpsApi';

type AdminAccessResponse = {
  ok: boolean;
  allowedTabs: string[];
  rawTabs: string[];
  isSuperAdmin: boolean;
};

export function useAdminAccess() {
  const { user, loading: authLoading } = useAuth();
  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
  const [rawTabs, setRawTabs] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setAllowedTabs([]);
      setRawTabs([]);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    vpsFetch<AdminAccessResponse>('/me/admin-access')
      .then((data) => {
        if (cancelled) return;

        setIsSuperAdmin(Boolean(data.isSuperAdmin));
        setRawTabs(data.rawTabs || []);
        setAllowedTabs(data.allowedTabs?.length ? data.allowedTabs : resolveAllowedAdminTabs(data.rawTabs || []));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsSuperAdmin(false);
        setRawTabs([]);
        setAllowedTabs([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return {
    allowedTabs,
    rawTabs,
    isSuperAdmin,
    canAccessAdmin: allowedTabs.length > 0,
    loading,
  };
}
