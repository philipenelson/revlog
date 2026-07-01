# Mobile auth: expo-secure-store and Refresh-Token header

## Context

The web app stores the refresh token in an httpOnly cookie set by the Express API. The browser handles cookies transparently — the client never reads or writes the cookie directly, and JavaScript cannot access it. This is the preferred security model for web clients.

React Native does not implement httpOnly cookies. The `fetch` API in React Native does not persist cookies across requests, and there is no browser-managed cookie jar. A different token storage and transmission mechanism is required for the mobile client.

Three storage options were considered for the mobile client:

1. **AsyncStorage** — React Native's built-in key-value store. Not encrypted; any app with file system access can read it. Not suitable for auth tokens.
2. **expo-secure-store** — wraps the iOS Keychain (iOS) and Android Keystore (Android). OS-level hardware-backed encryption. The data is inaccessible to other apps and survives app restarts. Already listed in `apps/mobile/package.json`.
3. **In-memory only** — tokens live in JavaScript memory. Lost on app restart; user must re-authenticate every session. Unacceptable UX.

## Decision

Store both the access token and the refresh token in **`expo-secure-store`**. At runtime, the access token is also kept in memory (to avoid a Keychain read on every request) and written through to secure store so it survives app restarts.

### Token transmission on mobile

The mobile `TokenHttpClient` (see ADR 0024):

- Reads the access token from memory (falling back to secure store on cold start)
- Injects `Authorization: Bearer <accessToken>` on every authenticated request
- On `POST /auth/refresh`, injects `Refresh-Token: <refreshToken>` as a request header
- Sends `X-Client-Platform: mobile` on every request (see below)

`expo-secure-store` reads are slow enough to matter in a login-heavy flow with several back-to-back requests. `infrastructure/storage/secureStorage.ts` caches each key's in-flight/last-resolved read behind a single shared promise, with a sliding ~3s expiry that resets on every access. A write updates the cache immediately (no round-trip re-read); after 3s of no reads the entry drops and the next read goes back to the Keychain/Keystore, so the value never drifts far from the source of truth. This only guards `secureStorage` itself — `TokenHttpClient` already keeps the active session in memory and does not re-read secure storage per request.

### How mobile receives the refresh token: `X-Client-Platform` header

Gap found during implementation: the API only ever places the refresh token in an httpOnly cookie (`POST /auth/login`, `GET /auth/verify-email`, `POST /auth/refresh`) — it was never in the JSON body. That's correct for web (the cookie is the point — inaccessible to JS, protecting against XSS) but leaves mobile with no way to obtain a refresh token at all, since it has no cookie jar (see Context above).

Two mechanisms were considered and rejected before this one:

- **Always include `refreshToken` in the JSON body for every client** — simplest, but means the raw refresh token is now present in a JS-readable response on every *web* login too, weakening the exact protection the httpOnly cookie exists to provide.
- **Rely on browser CORS header-exposure rules to hide a custom response header from web JS by omission** (not adding it to `Access-Control-Expose-Headers`) — technically sound (browsers enforce this, not a hack), but leverages an implicit difference in how browsers vs. React Native's `fetch` treat unexposed headers. Correct behavior would depend on a CORS config detail nobody's actively looking at, which is exactly the kind of implicit, hard-to-debug-later mechanism to avoid.

**Decision:** the mobile client sends an explicit `X-Client-Platform: mobile` request header on every call. `POST /auth/login`, `GET /auth/verify-email`, and `POST /auth/refresh` check for this header and, only when present, include `refreshToken` in the JSON response body **in addition to** the httpOnly cookie (which mobile simply ignores). Web never sends the header, so its responses are byte-for-byte unchanged. This is the same explicit-header idiom already used for the `Refresh-Token` request header below — one consistent, visible convention for "this call is from mobile," rather than two different mechanisms.

The mobile-only `refreshToken` field is added to the shared `Session` type (`packages/api-client`) as optional (`refreshToken?: string`). Web's code never reads it. Mobile's `AuthProvider` reads it explicitly off the `Session` returned by `login` / `verifyEmail` / `refreshSession` and persists it via `secureStorage` — the extraction is a plain, visible step in the auth flow, not something `TokenHttpClient` does implicitly as a side effect of parsing the response.

This is the standard pattern for mobile + web auth: web gets the httpOnly-cookie treatment specifically because browsers are unusually exposed to XSS; native mobile apps don't have that vulnerability class in the same way, so receiving the token directly and relying on OS-level secure storage (Keychain/Keystore) is the normal, secure approach — not a compromise relative to web.

### API change: Refresh-Token header fallback + X-Client-Platform

`POST /auth/refresh` gains a **`Refresh-Token` header path** checked only when no `refreshToken` cookie is present in the request. The web path (httpOnly cookie) is unchanged. The logic in the refresh route becomes:

```
token = req.cookies.refreshToken ?? req.headers['refresh-token']
```

Additionally, `POST /auth/login`, `GET /auth/verify-email`, and `POST /auth/refresh` check `req.header('x-client-platform') === 'mobile'` and, only then, add `refreshToken` to the JSON response body (see above).

This is the minimum API surface change to support mobile: no new endpoints, no breaking change to the web client's request or response shape.

### Proactive token refresh on foreground

The mobile `TokenHttpClient` checks access token expiry before each request, identical to the web's proactive refresh logic (ADR 0021). Additionally, the mobile `AuthProvider` triggers a silent refresh when the app returns to the foreground (`AppState` change from `background` to `active`), handling the case where the access token expired while the app was suspended.

### Logout

Logout clears both keys from `expo-secure-store` and clears the in-memory token state. The next app launch finds no stored tokens and routes to the login screen.

## Status

accepted

## Consequences

- Auth tokens are protected by the OS Keychain / Keystore — inaccessible to other apps and not readable from the file system.
- Both API changes (Refresh-Token header fallback, X-Client-Platform-gated refreshToken in the body) are backwards-compatible; no existing web client behaviour changes.
- The refresh token is now present in the JSON body of three mobile responses. This is an accepted, standard tradeoff: web's httpOnly cookie exists specifically to defend against XSS reading the token via JS; a native mobile app doesn't have that vulnerability class, so it can safely receive the token directly and rely on Keychain/Keystore instead.
- Cold app starts incur one Keychain read to restore the access token; subsequent requests use the in-memory copy. Rapid successive reads within ~3s are served from `secureStorage`'s cache rather than hitting the Keychain/Keystore again.
- Forgot-password flows that require the user to click a link in their email open in the browser; the mobile app does not need to handle the reset URL in V1 (deep linking is V2).
