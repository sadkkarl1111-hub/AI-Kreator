import { useEffect, useState } from 'react';
import {
  AppAuthSession,
  AppAuthUser,
  clearAuthTokensFromUrl,
  exchangeSessionFromTokens,
  extractAuthTokensFromUrl,
  getStoredAuthSession,
  isAuthSessionExpired,
  logoutStoredAuthSession,
  onStoredAuthSessionChange,
  refreshStoredAuthSession,
} from '@/lib/authSession';

type InitialAuthState = {
  session: AppAuthSession | null;
  user: AppAuthUser | null;
  loading: boolean;
};

export const getInitialAuthState = (): InitialAuthState => {
  const storedSession = getStoredAuthSession();
  const tokensFromUrl = extractAuthTokensFromUrl();

  return {
    session: storedSession,
    user: storedSession?.user ?? null,
    loading: Boolean(tokensFromUrl?.accessToken || (storedSession && isAuthSessionExpired(storedSession))),
  };
};

export function useAuth() {
  const [initialState] = useState(getInitialAuthState);
  const [session, setSession] = useState<AppAuthSession | null>(initialState.session);
  const [user, setUser] = useState<AppAuthUser | null>(initialState.user);
  const [loading, setLoading] = useState(initialState.loading);

  useEffect(() => {
    let mounted = true;

    const syncFromStorage = () => {
      const nextSession = getStoredAuthSession();
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    const bootstrap = async () => {
      try {
        const tokensFromUrl = extractAuthTokensFromUrl();

        if (tokensFromUrl?.accessToken) {
          const nextSession = await exchangeSessionFromTokens(tokensFromUrl);
          clearAuthTokensFromUrl();
          if (!mounted) return;
          setSession(nextSession);
          setUser(nextSession.user);
          return;
        }

        const storedSession = getStoredAuthSession();
        if (storedSession && isAuthSessionExpired(storedSession)) {
          const refreshedSession = await refreshStoredAuthSession().catch(() => null);
          if (!mounted) return;
          setSession(refreshedSession);
          setUser(refreshedSession?.user ?? null);
          return;
        }

        syncFromStorage();
      } catch {
        clearAuthTokensFromUrl();
        if (!mounted) return;
        setSession(null);
        setUser(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const unsubscribe = onStoredAuthSessionChange(syncFromStorage);
    void bootstrap();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await logoutStoredAuthSession();
    setSession(null);
    setUser(null);
  };

  return { user, session, loading, signOut };
}
