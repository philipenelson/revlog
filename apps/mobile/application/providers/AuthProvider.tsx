import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { refreshSession, type Session } from '@maintenance-log/api-client';
import {
  restoreSession as restoreTokens,
  setSessionTokens,
  clearSessionTokens,
  tokenHttpClient,
} from '@/infrastructure/http/TokenHttpClient';

interface AuthContextValue {
  session: Session | null;
  isRestoring: boolean;
  setSession: (session: Session) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Persists the refresh token mobile receives back (ADR 0025) alongside
// updating the in-memory/context session — mirrors web's
// sessionStore.setSession, just with an extra secure-store write.
function persistSession(session: Session): void {
  if (session.refreshToken) {
    void setSessionTokens(session.accessToken, session.accessTokenExpiresAt, session.refreshToken);
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Cold start: expo-secure-store has no session object, only tokens (ADR
  // 0025). Hydrate TokenHttpClient's in-memory tokens, then call
  // POST /auth/refresh (Refresh-Token header) for a fresh session — the
  // same silent-restore shape as web's cookie-based restore on mount.
  useEffect(() => {
    let cancelled = false;

    restoreTokens()
      .then((hadStoredSession) => {
        if (!hadStoredSession) return null;
        return refreshSession(tokenHttpClient);
      })
      .then((restored) => {
        if (cancelled || !restored) return;
        persistSession(restored);
        setSessionState(restored);
      })
      .catch(() => {
        // No valid session to restore — consumers gate on isRestoring and
        // fall back to their existing no-session handling once it settles.
        void clearSessionTokens();
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function setSession(newSession: Session): void {
    persistSession(newSession);
    setSessionState(newSession);
  }

  function clearSession(): void {
    setSessionState(null);
    void clearSessionTokens();
  }

  const value: AuthContextValue = { session, isRestoring, setSession, clearSession };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
