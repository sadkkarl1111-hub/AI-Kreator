import { beforeEach, describe, expect, it } from 'vitest';
import { setStoredAuthSession } from '@/lib/authSession';
import { getInitialAuthState } from '@/hooks/useAuth';

const validSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'bearer',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  expiresIn: 3600,
  user: {
    id: 'user-1',
    email: 'user@example.com',
  },
};

describe('getInitialAuthState', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('nie pokazuje ekranu ładowania dla ważnej zapisanej sesji', () => {
    setStoredAuthSession(validSession);

    expect(getInitialAuthState()).toEqual({
      session: validSession,
      user: validSession.user,
      loading: false,
    });
  });

  it('włącza ładowanie tylko wtedy, gdy wygasła sesja wymaga odświeżenia', () => {
    const expiredSession = {
      ...validSession,
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    };
    setStoredAuthSession(expiredSession);

    expect(getInitialAuthState()).toEqual({
      session: expiredSession,
      user: expiredSession.user,
      loading: true,
    });
  });

  it('od razu kończy inicjalizację, gdy użytkownik nie ma sesji', () => {
    expect(getInitialAuthState()).toEqual({
      session: null,
      user: null,
      loading: false,
    });
  });
});
