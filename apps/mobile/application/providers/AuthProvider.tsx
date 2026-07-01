import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { Session } from '@maintenance-log/api-client';
import { setSessionTokens, clearSessionTokens } from '@/infrastructure/http/TokenHttpClient';

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

  // No session restore across a full app restart (ADR 0025 update,
  // 2026-07-02 — see docs/specs/mobile-app/auth.md UC-MOB-AUTH-7): there is
  // no reliable "app is about to be killed" hook on either platform, so cold
  // start is the only point a stale session can be cleared. Every mount
  // clears expo-secure-store unconditionally, regardless of whether the
  // stored tokens were still valid — the Owner signs in again every launch.
  // isRestoring just gates the first render while that clear resolves, so
  // RootRedirect doesn't flash before it's done.
  useEffect(() => {
    let cancelled = false;

    clearSessionTokens().finally(() => {
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
