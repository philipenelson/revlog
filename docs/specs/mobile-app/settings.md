# Mobile Settings Screen Spec

**Area:** Mobile / Settings
**Status:** Planned
**Last updated:** 2026-07-05

---

## Overview

The mobile Settings screen is accessed via the gear icon in the Garage header (top-right) and pushed onto the stack as a full-screen screen. It covers account information (read-only, offline-cached), a language selector, legal page links (opening in the browser), and logout. (The web app will get its own settings screen in a separate, later effort — not covered by this spec.)

Design file: [`revlog-mobile-settings.html`](../../designs/mobile/revlog-mobile-settings.html)

Related: account data comes from [`GET /users/me`](../user/user-api.md) ([ADR 0033](../../adr/0033-user-endpoint.md)); logout uses [`POST /auth/logout`](../auth/logout-api.md) ([ADR 0034](../../adr/0034-auth-logout-and-online-required-mobile-logout.md)); the language selector persists a locale preference ([ADR 0035](../../adr/0035-mobile-language-preference.md)).

---

## Use Cases

### UC-MOB-SETTINGS-1 — Owner views account information

**Actor:** Owner
**Precondition:** Owner is authenticated; Settings screen is open.
**Milestones:** [V1](../../milestones/v1.md)

1. Settings screen reads the Owner's display name and email from the locally cached profile via `ProfileRepository` (offline-first — renders immediately from cache, even with no connectivity).
2. The cache is populated/refreshed by `SyncService.pull()` calling `GET /users/me`; network I/O stays in SyncService, and the viewmodel never calls the API directly.
3. Renders an Account section showing name and email as read-only fields. Stale data is shown offline rather than a loading/unavailable state.
4. No edit capability in this task. Name/email (and password) changes are sensitive, online-only, OTP-confirmed flows — a separate future effort.

---

### UC-MOB-SETTINGS-2 — Owner opens a legal page in the browser

**Actor:** Owner
**Precondition:** Owner is on the Settings screen.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps one of: Terms of Service, Privacy Policy, or Cookie Policy.
2. App calls `Linking.openURL('https://revlog.dev/terms')` (or `/privacy`, `/cookies`).
3. The device's default browser opens the corresponding page on the web app.

---

### UC-MOB-SETTINGS-3 — Owner logs out

**Actor:** Owner
**Precondition:** Owner is on the Settings screen.
**Milestones:** [V1](../../milestones/v1.md)

Logout is **online-required** (see [ADR 0034](../../adr/0034-auth-logout-and-online-required-mobile-logout.md)) — it mirrors the canonical [UC-MOB-AUTH-6](./auth.md#uc-mob-auth-6--owner-logs-out).

1. Owner taps `[Log out]`.
2. App shows a confirmation alert: "Log out of Revlog?"
3. Owner confirms.
4. App calls `POST /auth/logout` **with tokens still present** (the call needs the refresh token) to revoke it server-side.
5. **On success** (or any server *response*, including a 401 for an already-invalid token): clear `expo-secure-store` + in-memory session and navigate to login.
6. **On network failure** (offline / timeout — no response): keep the session and show an error, e.g. "You need to be online to log out."

---

### UC-MOB-SETTINGS-4 — Owner changes the app language

**Actor:** Owner
**Precondition:** Owner is on the Settings screen.
**Milestones:** [V1](../../milestones/v1.md)

1. Owner taps the Language row and picks one of: English, Português (Brasil), Español.
2. App persists the chosen locale (see [ADR 0035](../../adr/0035-mobile-language-preference.md)); the choice survives app restarts.
3. The Language row reflects the current selection.
4. No app strings are translated yet — this seeds the future internationalization effort, which will read the same stored locale. (This limitation is intentional for this task.)

---

## Screen layout

```
┌─────────────────────────────┐
│  ‹ Garage        Settings   │
├─────────────────────────────┤
│  ACCOUNT                    │
│  Philip Russo               │
│  Display name               │
│  p@example.com              │
│  Email                      │
├─────────────────────────────┤
│  PREFERENCES                │
│  Language     English    ›  │
├─────────────────────────────┤
│  LEGAL                      │
│  Terms of Service        ›  │
│  Privacy Policy          ›  │
│  Cookie Policy           ›  │
├─────────────────────────────┤
│  SUPPORT                    │
│  revlog.dev              ›  │
├─────────────────────────────┤
│                             │
│  [ Log out ]  (destructive) │
│                             │
└─────────────────────────────┘
```

Each Legal, Support, and the Language row is a tappable list item with a disclosure chevron. Account rows are display-only (no chevron, not tappable). The header shows a back control ("‹ Garage") and the "Settings" title, matching the design file.

---

## Acceptance Criteria

- [ ] Settings screen is reachable via the gear icon in the Garage header (top-right)
- [ ] Account section shows the Owner's display name and email from the local `ProfileRepository` cache, and still shows them (stale) when offline
- [ ] Language row shows the current locale and lets the Owner pick English / Português (Brasil) / Español; the choice persists across app restarts
- [ ] Terms of Service, Privacy Policy, and Cookie Policy rows open the correct URLs in the browser
- [ ] Support row opens `https://revlog.dev` in the browser
- [ ] `[Log out]` shows a confirmation alert before proceeding
- [ ] On confirm, logout calls `POST /auth/logout`; on success it clears expo-secure-store and navigates to login
- [ ] On a network failure during logout, the session is kept and an error is shown ("You need to be online to log out")

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Legal pages in browser | `Linking.openURL()` | Legal content is already maintained on the web app; no need to duplicate or maintain native screens |
| Account info source | Cached from `GET /users/me`, shown offline-first | Stale-but-present beats a loading/unavailable state; identity rarely changes (ADR 0033) |
| Account info read-only here | Display only | Name/email/password edits are sensitive, online-only, OTP-confirmed flows — a separate future effort |
| Logout online-required | Revoke server-side before clearing locally; error if offline | A logout that leaves a valid refresh token alive server-side is not a real logout (ADR 0034) |
| Language selector without i18n | Persist the locale; don't translate strings yet | Ships the control now; seeds the later i18n effort (ADR 0035) |

---

## Out of scope

- Account name / email / password editing → future online + OTP-confirmed flow (own spec)
- Full internationalization (translating app strings, device-locale default) → later V1 effort, own ADR + spec (ADR 0035)
- Notification preferences → V2 (push notifications are V2)
- App version / build info display → V2
- Web app settings screen → separate, later effort (not this spec)
