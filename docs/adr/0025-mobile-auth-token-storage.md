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

### API change: Refresh-Token header fallback

`POST /auth/refresh` gains a **`Refresh-Token` header path** checked only when no `refreshToken` cookie is present in the request. The web path (httpOnly cookie) is unchanged. The logic in the refresh route becomes:

```
token = req.cookies.refreshToken ?? req.headers['refresh-token']
```

This is the minimum API surface change: one existing route, one additional token source, no new endpoints, no breaking change to the web client.

### Proactive token refresh on foreground

The mobile `TokenHttpClient` checks access token expiry before each request, identical to the web's proactive refresh logic (ADR 0021). Additionally, the mobile `AuthProvider` triggers a silent refresh when the app returns to the foreground (`AppState` change from `background` to `active`), handling the case where the access token expired while the app was suspended.

### Logout

Logout clears both keys from `expo-secure-store` and clears the in-memory token state. The next app launch finds no stored tokens and routes to the login screen.

## Status

accepted

## Consequences

- Auth tokens are protected by the OS Keychain / Keystore — inaccessible to other apps and not readable from the file system.
- The single API change (Refresh-Token header fallback) is backwards-compatible; no existing web client behaviour changes.
- Cold app starts incur one Keychain read to restore the access token; subsequent requests use the in-memory copy.
- Forgot-password flows that require the user to click a link in their email open in the browser; the mobile app does not need to handle the reset URL in V1 (deep linking is V2).
