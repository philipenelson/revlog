import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { ApiError, login as loginRequest } from '@maintenance-log/api-client';
import type { Session } from '@maintenance-log/api-client';
import { setSessionTokens, clearSessionTokens, tokenHttpClient } from '@/adapters/http/TokenHttpClient';
import { credentialStore } from '@/adapters/storage/credentialStore';
import { credentialForStore } from '@/application/auth/offlineSession';
import { preferences } from '@/adapters/storage/preferences';
import { logger } from '@/adapters/logging/logger';

interface AuthContextValue {
  session: Session | null;
  isRestoring: boolean;
  // True when the current session was reconstructed offline (no server tokens,
  // ADR 0036). Reads work from SQLite; SyncProvider defers network I/O until a
  // foreground silent-upgrade replaces it with a real session.
  isOffline: boolean;
  // Set at cold start (after the token clear) so RootRedirect can send a
  // returning Owner straight to the login screen instead of Welcome.
  hasStoredCredentials: boolean;
  setSession: (session: Session) => void;
  // Flip the current Account out of ONBOARDING after the wizard resolves
  // (completed or skipped). Optimistic — the server resolves it independently.
  resolveOnboarding: () => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// A reconstructed offline session carries an empty accessToken (ADR 0036).
function isOfflineSession(session: Session): boolean {
  return session.accessToken === '';
}

// Persists tokens for an ONLINE session only. An offline session has no
// refreshToken and an empty accessToken — nothing to write, and TokenHttpClient
// must stay unauthenticated so it never sends an empty Bearer.
function persistSession(session: Session): void {
  if (session.refreshToken && session.accessToken) {
    void setSessionTokens(session.accessToken, session.accessTokenExpiresAt, session.refreshToken);
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);

  // No session restore across a full app restart (ADR 0025 update,
  // 2026-07-02 — see docs/specs/mobile-app/auth.md UC-MOB-AUTH-7): there is
  // no reliable "app is about to be killed" hook on either platform, so cold
  // start is the only point a stale session can be cleared. Every mount
  // clears the token keys unconditionally. What survives is the credentialStore
  // carve-out (ADR 0036) — we read whether credentials exist so RootRedirect
  // can offer offline/biometric sign-in. isRestoring gates the first render
  // until both resolve, so RootRedirect doesn't flash before it's done.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await clearSessionTokens();
      const hasCreds = await credentialStore.has();
      if (!cancelled) {
        setHasStoredCredentials(hasCreds);
        setIsRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function setSession(newSession: Session): void {
    persistSession(newSession);
    setSessionState(newSession);
  }

  // The wizard resolves onboarding by completing (first vehicle written to the
  // outbox) or skipping (POST /onboarding/skip). Either way the server moves the
  // Account to ACTIVE — on complete, when the outbox flushes POST /vehicles
  // (ADR 0015); on skip, immediately. This optimistic in-memory flip keeps the
  // Owner from being routed straight back into onboarding before that lands, and
  // the cached credential (offline/biometric login carve-out, ADR 0036) is
  // updated so a later cold-start or offline login agrees.
  function resolveOnboarding(): void {
    setSessionState((prev) =>
      prev && prev.account.status === 'ONBOARDING'
        ? { ...prev, account: { ...prev.account, status: 'ACTIVE' } }
        : prev,
    );
    void (async () => {
      const stored = await credentialStore.get();
      if (stored && stored.accountStatus !== 'ACTIVE') {
        await credentialStore.save({ ...stored, accountStatus: 'ACTIVE' });
      }
    })();
  }

  function clearSession(): void {
    setSessionState(null);
    setHasStoredCredentials(false);
    // Logout fully signs the Owner out of this device: tokens, the stored
    // credentials that back offline/biometric login, and the biometric flags
    // all go (ADR 0036). The next sign-in must be a fresh online login.
    void clearSessionTokens();
    void credentialStore.clear();
    void preferences.clearBiometric();
  }

  // Silent offline→online upgrade (UC-MOB-OFF-2). When an offline session is
  // live and the app returns to the foreground, replay the stored credentials
  // to mint real tokens so the outbox can flush. Network error → stay offline;
  // 401 → stored password is stale, so clear and bounce to login. Single-flight
  // via a ref so overlapping foreground events don't double-run it.
  const upgradeInFlight = useRef(false);
  useEffect(() => {
    async function upgradeIfOffline(): Promise<void> {
      if (upgradeInFlight.current) return;
      if (!session || !isOfflineSession(session)) return;
      const stored = await credentialStore.get();
      if (!stored) return;

      upgradeInFlight.current = true;
      try {
        const real = await loginRequest(tokenHttpClient, { email: stored.email, password: stored.password });
        setSession(real);
        await credentialStore.save(credentialForStore({ email: stored.email, password: stored.password }, real));
      } catch (err) {
        if (err instanceof ApiError && err.status < 500) {
          logger.warn('offline session upgrade rejected — stored credentials are stale', { status: err.status });
          clearSession();
          router.replace('/(auth)/login');
        }
        // Network / 5xx: remain offline and retry on the next foreground.
      } finally {
        upgradeInFlight.current = false;
      }
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void upgradeIfOffline();
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const value: AuthContextValue = {
    session,
    isRestoring,
    isOffline: session != null && isOfflineSession(session),
    hasStoredCredentials,
    setSession,
    resolveOnboarding,
    clearSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
