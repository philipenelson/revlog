import { sessionStore } from '@/infrastructure/session/sessionStore';
import { refreshSession } from '@/model/services/authService';
import type { RequestInterceptor, ResponseInterceptor } from '@/infrastructure/http/apiClient';
import type { Session } from '@/model/types';

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
  refreshInFlight ??= refreshSession()
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
 * drops the session and lets the request go out unauthenticated — it 401s and
 * `createUnauthorizedInterceptor` handles the single redirect.
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
 * Redirects on a 401 the proactive refresh didn't prevent (a just-cleared
 * session, or — outside V1's model — a server-side revocation / clock skew).
 * `/auth/*` is skipped so a failed refresh's own 401 doesn't fire it. The
 * navigation is injected via `onUnauthorized` so this stays framework-free.
 */
export function createUnauthorizedInterceptor(onUnauthorized: () => void): ResponseInterceptor {
  return (res, path) => {
    if (res.status === 401 && !isAuthPath(path)) onUnauthorized();
    return res;
  };
}
