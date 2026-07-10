import { sessionStore } from '@/adapters/session/sessionStore';
import { cookieHttpClient } from '@/adapters/http/CookieHttpClient';
import { refreshSession } from '@maintenance-log/api-client';
import type { RequestInterceptor, ResponseInterceptor } from '@/adapters/http/apiClient';
import type { Session } from '@maintenance-log/api-client';

/** Refresh this many ms before the access token's `exp` — an in-flight-expiry guard (ADR 0021). */
const REFRESH_LEAD_MS = 30_000;

// Auth endpoints are excluded here, not in apiFetch: the refresh call must not
// recursively trigger a refresh, and a failed refresh's own 401 must not redirect.
const isAuthPath = (path: string) => path.startsWith('/auth/');

function needsRefresh(session: Session): boolean {
  return new Date(session.accessTokenExpiresAt).getTime() - Date.now() <= REFRESH_LEAD_MS;
}

// One shared refresh across all concurrent callers — rotation (ADR 0017) would
// 401 every refresh after the first, bouncing a just-refreshed user to /login.
let refreshInFlight: Promise<Session> | null = null;
function refreshOnce(): Promise<Session> {
  refreshInFlight ??= refreshSession(cookieHttpClient)
    .then((session) => {
      sessionStore.setSession(session);
      return session;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function withAuthHeader(init: RequestInit | undefined, accessToken: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return { ...init, headers };
}

/**
 * Proactively refreshes the access token before it expires, then attaches it.
 * No-op for `/auth/*` and for unauthenticated requests. On refresh failure it
 * drops the session; the refresh's own 401 (and the ensuing unauthenticated
 * request) trigger the redirect to /login via `createUnauthorizedInterceptor`.
 */
export const authRequestInterceptor: RequestInterceptor = async (path, init) => {
  if (isAuthPath(path)) return [path, init];

  let session = sessionStore.getSession();
  if (!session) return [path, init];

  if (needsRefresh(session)) {
    try {
      session = await refreshOnce();
    } catch {
      sessionStore.clearSession();
      return [path, init];
    }
  }

  return [path, withAuthHeader(init, session.accessToken)];
};

/**
 * Redirects to sign-in on any 401 — whether from a failed silent restore
 * (`POST /auth/refresh` on mount), a failed proactive refresh, or a normal
 * request whose token the server rejected. From `/login` the redirect is a
 * harmless no-op. The navigation is injected via `onUnauthorized` so this stays
 * framework-free.
 */
export function createUnauthorizedInterceptor(onUnauthorized: () => void): ResponseInterceptor {
  return (res) => {
    if (res.status === 401) onUnauthorized();
    return res;
  };
}
