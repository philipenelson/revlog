import { useCallback } from 'react';
import { ApiError, login as loginRequest } from '@maintenance-log/api-client';
import type { Session } from '@maintenance-log/api-client';
import type { LoginInput } from '@maintenance-log/domain';
import { tokenHttpClient } from '@/infrastructure/http/TokenHttpClient';
import { useAuth } from '@/application/providers/AuthProvider';
import { credentialStore } from '@/infrastructure/storage/credentialStore';
import { buildOfflineSession, credentialForStore } from '@/application/auth/offlineSession';
import { logger } from '@/infrastructure/logging/logger';

// The single sign-in path shared by the login screen (typed credentials) and
// biometric unlock (credentials fetched from the store). Online-first, with a
// network-error fallback to the stored credentials (ADR 0036). Both callers
// get the same behaviour and it is unit-tested once.
export type SignInResult =
  | { status: 'online'; session: Session }
  | { status: 'offline'; session: Session }
  | { status: 'invalidCredentials' }
  | { status: 'offlineUnavailable' }
  | { status: 'serviceError' };

export function useSignIn(): (credentials: LoginInput) => Promise<SignInResult> {
  const { setSession } = useAuth();

  return useCallback(
    async (credentials: LoginInput): Promise<SignInResult> => {
      try {
        const session = await loginRequest(tokenHttpClient, credentials);
        setSession(session);
        await captureCredential(credentials, session);
        return { status: 'online', session };
      } catch (err) {
        // The server responded — trust it. A 4xx is a real rejection we must
        // not paper over offline; a 5xx is a service problem. Mirrors the
        // network-vs-response split of online-required logout (ADR 0034).
        if (err instanceof ApiError) {
          return { status: err.status >= 500 ? 'serviceError' : 'invalidCredentials' };
        }
        // No response at all (network down / timeout) — try the stored creds.
        return signInOffline(credentials, setSession);
      }
    },
    [setSession],
  );
}

async function signInOffline(
  credentials: LoginInput,
  setSession: (session: Session) => void,
): Promise<SignInResult> {
  const stored = await credentialStore.get();
  if (stored && stored.email === credentials.email && stored.password === credentials.password) {
    const session = buildOfflineSession(stored);
    setSession(session);
    return { status: 'offline', session };
  }
  return { status: 'offlineUnavailable' };
}

// Best-effort: a Keychain write failure must not knock a successful online
// login into the offline branch, so it is swallowed (and logged) here.
async function captureCredential(credentials: LoginInput, session: Session): Promise<void> {
  try {
    await credentialStore.save(credentialForStore(credentials, session));
  } catch (err) {
    logger.warn('failed to persist credentials for offline login', { err: String(err) });
  }
}
