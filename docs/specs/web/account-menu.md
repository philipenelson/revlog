# Web Account Menu Spec

**Area:** Web / Garage
**Status:** Planned
**Last updated:** 2026-07-13

---

## Overview

Web gets an account menu instead of a dedicated Settings screen: clicking the avatar in the Garage header opens a dropdown containing account info, legal links, a support contact, and logout. There is no separate `/settings` route — the web app already has real pages for everything mobile's Settings screen has to link out to (`/terms`, `/privacy`, `/cookies`), and web has no offline story or device-only preferences (biometrics, a persisted language choice) to justify a standalone screen. This intentionally diverges from mobile's full-screen Settings (`docs/specs/mobile-app/settings.md`), which was scoped for a phone where "open the browser" is the only way to reach those pages.

Related: account data comes from [`GET /users/me`](../user/user-api.md) ([ADR 0033](../../adr/0033-user-endpoint.md)); logout uses [`POST /auth/logout`](../auth/logout-api.md) ([ADR 0034](../../adr/0034-auth-logout-and-online-required-mobile-logout.md)), already implemented server-side and exposed by `api-client` as `logout(client)` — this task is the first web consumer.

---

## Use Cases

### UC-WEB-ACCOUNT-1 — Owner opens the account menu and views their info

**Actor:** Owner
**Precondition:** Owner is authenticated and on the Garage screen.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner clicks the avatar in the top-right of the Garage header.
2. A dropdown opens, anchored to the avatar. It fetches the Owner's profile via `GET /users/me` (online-only — no local cache, unlike mobile) and shows display name + email at the top, read-only.
3. Clicking outside the dropdown, or pressing Escape, closes it.
4. No edit capability — matches mobile, name/email/password changes are a separate future online + OTP-confirmed effort.

### UC-WEB-ACCOUNT-2 — Owner opens a legal page from the account menu

**Actor:** Owner
**Precondition:** Account menu is open.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner clicks one of: Terms of Service, Privacy Policy, or Cookie Policy.
2. The app navigates in-app (`next/link`) to `/terms`, `/privacy`, or `/cookies` respectively, and the menu closes.

### UC-WEB-ACCOUNT-3 — Owner contacts support from the account menu

**Actor:** Owner
**Precondition:** Account menu is open.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner clicks "Support".
2. The browser opens the user's mail client with a new message addressed to `hello@revlog.app` (`mailto:`), matching the address already used on the legal pages.

### UC-WEB-ACCOUNT-4 — Owner logs out

**Actor:** Owner
**Precondition:** Account menu is open.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner clicks `[Log out]`.
2. The app calls `POST /auth/logout` via `cookieHttpClient` to revoke the refresh token server-side.
3. **On success, or any server response** (e.g. a 401 for an already-invalid session): clear the in-memory session (`sessionStore.clearSession()`) and redirect to `/login`.
4. **On network failure** (no response): keep the session, close the menu, and show an inline error, e.g. "You need to be online to log out." Mirrors mobile's online-required logout (ADR 0034) — a browser tab can lose connectivity mid-request the same way a phone can.

---

## Menu layout

```
                                            ┌───────────────────────────┐
                                            │  Jordan Reyes             │
                                            │  jordan@example.com       │
                                            ├───────────────────────────┤
                                            │  Terms of Service         │
                                            │  Privacy Policy           │
                                            │  Cookie Policy            │
                                            ├───────────────────────────┤
                                            │  Support                  │
                                            ├───────────────────────────┤
                                            │  Log out                  │
                                            └───────────────────────────┘
                                                            ▲
                                            [ JR ]  ←── avatar (click target)
```

Account rows are display-only. Terms/Privacy/Cookies/Support/Log out are each a clickable row; Log out is styled destructive (matches mobile's danger-colored button).

---

## Acceptance Criteria

- [ ] Clicking the avatar in the Garage header opens the account menu; clicking outside or pressing Escape closes it
- [ ] Menu shows the Owner's display name and email, fetched from `GET /users/me`
- [ ] Terms of Service, Privacy Policy, and Cookie Policy rows navigate in-app to `/terms`, `/privacy`, `/cookies` and close the menu
- [ ] Support row opens `mailto:hello@revlog.app`
- [ ] `[Log out]` calls `POST /auth/logout`; on success or any server response it clears the session and redirects to `/login`
- [ ] On a network failure during logout, the session is kept and an inline error is shown ("You need to be online to log out")

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| No dedicated `/settings` route | Dropdown menu on the Garage header instead | Every link mobile's Settings screen exists to provide (legal pages, logout) already has a first-class in-app destination or is a two-line action on web; a full page would just be a detour to the same content — user sign-off obtained before scoping this in |
| Account info source | Fetched live via `getCurrentUser()` (online-only), no local cache | Web has no SQLite/offline story (unlike mobile's `ProfileRepository`); the browser tab is only ever open while online-reachable in practice |
| Support destination | `mailto:hello@revlog.app` | Mobile's Support row opens revlog.dev because the app has no other way to reach the website; web is already on revlog.dev, so linking to itself is redundant. The legal pages already use this same address — user sign-off obtained |
| Legal links | In-app `next/link` navigation, not new tab | Standard behavior for every other internal link in the app; no reason to special-case these |
| Language selector | Omitted | Mobile's is backed by ADR 0035 (`expo-secure-store`), which is mobile-specific; a web equivalent needs its own persistence decision and is deferred, not assumed |
| Logout online-required | Same semantics as mobile (ADR 0034) | Consistency: a logout that leaves a valid refresh token alive server-side isn't a real logout, on any platform |

---

## Out of scope

- Account name / email / password editing → future online + OTP-confirmed flow (own spec), same as mobile
- Language selector for web → needs its own ADR (persistence mechanism) before it can be added
- A standalone `/settings` page/route → explicitly not needed per the Decisions above; revisit only if content grows beyond what a dropdown can hold
- Notification preferences → V2 (push notifications are V2)
