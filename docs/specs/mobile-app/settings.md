# Mobile Settings Screen Spec

**Area:** Mobile / Settings
**Status:** Not started
**Last updated:** 2026-06-30

---

## Overview

The Settings screen is unique to the mobile app — the web app has no equivalent standalone settings page. It is accessed via the gear icon in the Garage header and pushed onto the stack as a full-screen screen. It covers account information (read-only), legal page links (opening in the browser), and logout.

Design file: [`revlog-mobile-settings.html`](../../designs/mobile/revlog-mobile-settings.html)

---

## Use Cases

### UC-MOB-SETTINGS-1 — Owner views account information

**Actor:** Owner
**Precondition:** Owner is authenticated; Settings screen is open.
**Milestones:** [V1](../../milestones/v1.md)

1. Settings screen reads the Owner's display name and email from the locally cached account record.
2. Renders an Account section showing name and email as read-only fields.
3. No edit capability in V1.

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

1. Owner taps `[Log out]`.
2. App shows a confirmation alert: "Log out of Revlog?"
3. Owner confirms.
4. App clears tokens from `expo-secure-store` and memory.
5. App calls `POST /auth/logout` to invalidate the refresh token server-side (best-effort — proceeds even if the call fails due to no connectivity).
6. App navigates to the login screen.

---

## Screen layout

```
┌─────────────────────────────┐
│  ← Settings                 │
├─────────────────────────────┤
│  ACCOUNT                    │
│  Name      Philip Russo     │
│  Email     p@example.com    │
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

Each Legal and Support row is a tappable list item with a disclosure chevron. Account rows are display-only (no chevron, not tappable).

---

## Acceptance Criteria

- [ ] Settings screen is accessible from the gear icon on all Garage-stack screens
- [ ] Account section shows the Owner's display name and email from local cache
- [ ] Terms of Service, Privacy Policy, and Cookie Policy rows open the correct URLs in the browser
- [ ] Support row opens `https://revlog.dev` in the browser
- [ ] `[Log out]` shows a confirmation alert before proceeding
- [ ] After confirmation, tokens are cleared from expo-secure-store and app navigates to login
- [ ] Logout proceeds and navigates to login even if `POST /auth/logout` fails (e.g., no connectivity)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Legal pages in browser | `Linking.openURL()` | Legal content is already maintained on the web app; no need to duplicate or maintain native screens |
| Account info read-only | Display only in V1 | Account editing is not in V1 scope for web or mobile |
| Logout best-effort | Navigate to login even if API call fails | Token is expired/cleared client-side regardless; waiting for connectivity before logging out is bad UX |

---

## Out of scope

- Account name / email editing → V2
- Password change from Settings → V2 (current flow is forgot-password by email)
- Notification preferences → V2 (push notifications are V2)
- App version / build info display → V2
