# Shared API client package with HttpClient port

## Context

The web app's API services (`authService`, `vehicleService`, `logEntryService`, etc.) live in `apps/web/src/model/services/` and call `apiFetch` directly from the infrastructure layer. The mobile app needs the same service logic — same endpoints, same payloads, same response shapes — but uses a fundamentally different auth transport: the web relies on httpOnly cookies for the refresh token (handled transparently by the browser), while mobile must explicitly read tokens from `expo-secure-store` and inject them as `Authorization` and `Refresh-Token` headers.

Two approaches were considered:

1. **Duplicate services** — each app has its own `domain/services/` containing near-identical service files that call their own HTTP client. Simple now; painful when the API surface grows or changes, because every update must be applied twice.
2. **Shared package with an `HttpClient` port** — services live in a new `packages/api-client` workspace package and depend on an `HttpClient` interface rather than a concrete `apiFetch` function. Each app provides its own adapter that satisfies the interface.

## Decision

Create **`packages/api-client`** as a new workspace package. It exports:

- `HttpClient` — a TypeScript interface (Port) that services call for all network I/O
- All API services (`authService`, `vehicleService`, `logEntryService`, `onboardingService`, `insuranceService`, etc.) as functions that accept an `HttpClient` instance
- Shared domain types and request/response shapes used by those services

Each consuming app provides its own `HttpClient` adapter:

```ts
// packages/api-client/src/HttpClient.ts
export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
}
```

**Web adapter (`CookieHttpClient`)** wraps the existing `apiFetch` / `apiUpload` transport. Cookies are handled transparently by the browser — no changes to the cookie mechanism. The existing interceptor pipeline (auth header injection, proactive token refresh, retry policy) moves into this adapter.

**Mobile adapter (`TokenHttpClient`)** reads the access token from `expo-secure-store`, injects `Authorization: Bearer <accessToken>` on every request, and injects `Refresh-Token: <refreshToken>` on `POST /auth/refresh` calls. When the access token is expired, it performs a proactive refresh (same logic as the web's `CookieHttpClient`) before the request proceeds.

### Migration order

The web app migrates to `packages/api-client` **before** mobile services are written. This ensures mobile can consume the shared services from day one and no parallel service copies ever exist.

The migration step also renames `apps/web/src/model/` to `apps/web/src/domain/` — the correct DDD layer name (see ADR 0023).

## Status

accepted

## Consequences

- API endpoint paths, request payloads, and response unwrapping live in one place. A backend API change requires a single service update in `packages/api-client`.
- The `HttpClient` port abstraction is a thin, stable interface — one method per HTTP verb. The overhead is justified by the two structurally different auth transports that must satisfy it.
- Web's existing cookie-based auth, interceptors, retry policy, and proactive token refresh are unchanged in behaviour; they move into `CookieHttpClient`.
- Mobile services are identical to web services at the call-site level; all transport differences are encapsulated in `TokenHttpClient`.
- The web's ADR 0022 (retry policy) and ADR 0021 (proactive token refresh) remain valid — they describe behaviour that lives in `CookieHttpClient`.
