import { secureStorage } from '@/infrastructure/storage/secureStorage';
import { ApiError, TimeoutError } from '@maintenance-log/api-client/errors';
import type { HttpClient, RequestOptions } from '@maintenance-log/api-client/HttpClient';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Refresh this many ms before the access token's `exp` — mirrors web's lead time (ADR 0021). */
const REFRESH_LEAD_MS = 30_000;

const isRefreshPath = (path: string) => path === '/auth/refresh';
const isLogoutPath = (path: string) => path === '/auth/logout';

interface Session {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}

// In-memory only — set directly by AuthProvider after login/register-verify/
// refresh, never re-read from secureStorage per request (ADR 0025). Not
// hydrated from secureStorage on cold start: every app restart clears
// secureStorage before this module's consumers can read it (see AuthProvider
// and ADR 0025's "no session restore across a full app restart" update).
let session: Session | null = null;

export async function setSessionTokens(
  accessToken: string,
  accessTokenExpiresAt: string,
  refreshToken: string,
): Promise<void> {
  session = { accessToken, accessTokenExpiresAt, refreshToken };
  await Promise.all([
    secureStorage.setAccessToken(accessToken),
    secureStorage.setRefreshToken(refreshToken),
  ]);
}

export async function clearSessionTokens(): Promise<void> {
  session = null;
  await secureStorage.clear();
}

function needsRefresh(s: Session): boolean {
  return new Date(s.accessTokenExpiresAt).getTime() - Date.now() <= REFRESH_LEAD_MS;
}

// Single-flight refresh — mirrors web's authInterceptor so concurrent
// callers share one POST /auth/refresh instead of each rotating the refresh
// token out from under the others (ADR 0017).
let refreshInFlight: Promise<void> | null = null;
function refreshOnce(): Promise<void> {
  refreshInFlight ??= request<{ accessToken: string; accessTokenExpiresAt: string; refreshToken: string }>(
    '/auth/refresh',
    'POST',
  )
    .then((body) => setSessionTokens(body.accessToken, body.accessTokenExpiresAt, body.refreshToken))
    .catch(async (err) => {
      await clearSessionTokens();
      throw err;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function buildHeaders(path: string, body: unknown): Headers {
  const headers = new Headers();
  if (!(body instanceof FormData)) headers.set('Content-Type', 'application/json');
  headers.set('X-Client-Platform', 'mobile');
  if (isRefreshPath(path)) {
    if (session?.refreshToken) headers.set('Refresh-Token', session.refreshToken);
  } else {
    if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
    // Logout is authenticated AND must present the refresh token so the
    // server can revoke it (ADR 0034).
    if (isLogoutPath(path) && session?.refreshToken) headers.set('Refresh-Token', session.refreshToken);
  }
  return headers;
}

function serializeBody(body: unknown): BodyInit_ | undefined {
  if (body === undefined) return undefined;
  if (body instanceof FormData) return body;
  return JSON.stringify(body);
}

async function request<T>(path: string, method: string, body?: unknown, options?: RequestOptions): Promise<T> {
  // Proactive refresh before the request, not after a 401 — mirrors web's
  // authRequestInterceptor. Skipped for the refresh call itself, and for
  // logout: refreshing would rotate the very token we're about to revoke,
  // and a refresh that fails offline clears the session — which would defeat
  // online-required logout's "stay signed in when offline" contract (ADR 0034).
  if (!isRefreshPath(path) && !isLogoutPath(path) && session && needsRefresh(session)) {
    try {
      await refreshOnce();
    } catch {
      // Proceed unauthenticated; the server rejects with 401 and the caller
      // (a viewmodel) surfaces that as an auth error.
    }
  }

  const timeoutMs = options?.timeoutMs;
  const controller = timeoutMs ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: buildHeaders(path, body),
      body: serializeBody(body),
      signal: controller?.signal,
    });
  } catch (err) {
    if (controller?.signal.aborted) throw new TimeoutError();
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  const responseBody = await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, responseBody);
  return responseBody as T;
}

// Mobile adapter for the HttpClient port (ADR 0024). Retry/backoff (ADR 0022,
// web-only) isn't implemented here — not needed by any V1 mobile use case yet.
export const tokenHttpClient: HttpClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, 'GET', undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, 'POST', body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, 'PATCH', body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, 'PUT', body, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, 'DELETE', undefined, options),
};
