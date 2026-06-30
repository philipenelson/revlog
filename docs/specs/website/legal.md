# Legal Pages Spec

**Routes:** `/terms` (Terms of Service), `/privacy` (Privacy Policy), `/cookies` (Cookie Policy)  
**Status:** Not started  
**Last updated:** 2026-06-30

---

## Overview

Three static public pages — Terms of Service, Privacy Policy, and Cookie Policy — that satisfy the legal prerequisites for any public Revlog launch. The Terms and Privacy pages are linked from the login screen footer (replacing the existing `href="#"` placeholders) and from the marketing site footer. All three pages are linked from each other's footers. A cookie consent notice is displayed to first-time visitors. No authentication is required to view any legal page.

---

## Use Cases

### UC-LEGAL-1 — Visitor reads the Terms of Service

**Actor:** Any visitor (unauthenticated or authenticated)  
**Precondition:** None  
**Milestones:** [V1](../../milestones/v1.md)

1. Visitor navigates to `/terms` (directly, or via the login footer link)
2. System renders the Terms of Service page
3. Visitor can read the full terms, then navigate back to `/login` via the back link in the page header

---

### UC-LEGAL-2 — Visitor reads the Privacy Policy

**Actor:** Any visitor (unauthenticated or authenticated)  
**Precondition:** None  
**Milestones:** [V1](../../milestones/v1.md)

1. Visitor navigates to `/privacy` (directly, or via the login footer link)
2. System renders the Privacy Policy page
3. Visitor can navigate back to `/login` via the back link in the page header

---

### UC-LEGAL-3 — User opens a legal page from the login footer

**Actor:** Any visitor on the `/login` screen  
**Precondition:** User is viewing the login or register form  
**Milestones:** [V1](../../milestones/v1.md)

1. User clicks "Terms of Service" or "Privacy Policy" in the login form footer
2. Browser navigates to `/terms` or `/privacy` respectively
3. User can return to `/login` via the back link

---

### UC-LEGAL-4 — Visitor reads the Cookie Policy

**Actor:** Any visitor (unauthenticated or authenticated)  
**Precondition:** None  
**Milestones:** [V1](../../milestones/v1.md)

1. Visitor navigates to `/cookies` (directly, or via a link in any legal page footer)
2. System renders the Cookie Policy page
3. Visitor can navigate back to `/login` via the back link

---

### UC-LEGAL-5 — First-time visitor sees the cookie notice

**Actor:** Any visitor who has not previously acknowledged the cookie notice  
**Precondition:** No `cookie-consent` key in `localStorage`  
**Milestones:** [V1](../../milestones/v1.md)

1. Visitor arrives at any page in `apps/web`
2. System renders a fixed-bottom cookie notice: "We use one cookie to keep you signed in. [Learn more]" with a "Got it" dismiss button
3. User clicks "Got it"
4. System writes `cookie-consent=acknowledged` to `localStorage` and hides the notice
5. On subsequent visits, the notice is not shown

---

## Content Requirements

### Terms of Service (`/terms`)

Must cover at minimum:
- About Revlog — what the product is
- Account eligibility — who may create an account
- Your data — user-generated content (vehicle records, log entries) belongs to the owner
- Acceptable use — what is and is not permitted
- Service availability — no uptime guarantee for V1
- Termination and data deletion — how to close an account and what happens to data
- Limitation of liability
- Changes to these terms

### Privacy Policy (`/privacy`)

Must cover at minimum:
- What data is collected — email, name, vehicle data, log entries, no payment data
- How data is used — to provide the service; not sold or shared with third parties
- Data storage and retention
- Third-party services — none that receive personal data in V1
- GDPR rights (for EU users) — access, rectification, erasure
- CCPA rights (for California users)
- Contact information for data requests

### Cookie Policy (`/cookies`)

Must cover at minimum:
- What cookies Revlog uses — one HttpOnly session cookie (`refreshToken`), strictly necessary for authentication
- Why strictly necessary cookies do not require consent under GDPR/PECR
- Cookie lifetime — browser session (no `Max-Age` in V1; expires on browser close)
- No third-party or tracking cookies
- How to clear cookies (browser settings)

---

## Layout

Both pages share the same layout:

- Full-page centered column, `max-width: 720px`, symmetric side padding
- Page header: Revlog wordmark (left) + "← Back to sign in" link (right), separated from content by a bottom border
- Page content: document-style typography — h1 for the page title, h2 for sections, body text
- Page footer: "© 2026 Revlog. All rights reserved." centered, with links to the other two legal pages

Background is `--surface-base`; content column has no card chrome — it reads as a clean document.

---

## Acceptance Criteria

### Routes

- [ ] `GET /terms` returns HTTP 200 and renders the Terms of Service page
- [ ] `GET /privacy` returns HTTP 200 and renders the Privacy Policy page
- [ ] `GET /cookies` returns HTTP 200 and renders the Cookie Policy page
- [ ] All three routes are publicly accessible without authentication

### Login footer links

- [ ] "Terms of Service" link in the login footer (`LoginScreen.tsx`) navigates to `/terms` (replacing `href="#"`)
- [ ] "Privacy Policy" link in the login footer (`LoginScreen.tsx`) navigates to `/privacy` (replacing `href="#"`)

### Marketing site footer links

- [ ] `Footer.astro` in `apps/website` includes links to `{WEB_APP_URL}/terms`, `{WEB_APP_URL}/privacy`, and `{WEB_APP_URL}/cookies`

### Content

- [ ] `/terms` includes an `<h1>` containing "Terms of Service"
- [ ] `/privacy` includes an `<h1>` containing "Privacy Policy"
- [ ] `/cookies` includes an `<h1>` containing "Cookie Policy"
- [ ] All three pages include a back link to `/login`
- [ ] Each legal page footer links to the other two legal pages

### Cookie notice

- [ ] A fixed-bottom cookie notice is shown on first visit (no `cookie-consent` in `localStorage`)
- [ ] "Got it" button dismisses the notice and writes `cookie-consent=acknowledged` to `localStorage`
- [ ] The notice is not shown on subsequent visits
- [ ] "Learn more" in the notice links to `/cookies`

### Page titles

- [ ] `/terms` — `<title>` is "Terms of Service – Revlog"
- [ ] `/privacy` — `<title>` is "Privacy Policy – Revlog"
- [ ] `/cookies` — `<title>` is "Cookie Policy – Revlog"

### E2E tests (Cypress)

- [ ] `/terms` renders the Terms of Service heading
- [ ] `/privacy` renders the Privacy Policy heading
- [ ] `/cookies` renders the Cookie Policy heading
- [ ] Clicking "Terms of Service" in the login footer navigates to `/terms`
- [ ] Clicking "Privacy Policy" in the login footer navigates to `/privacy`
- [ ] Cookie notice is visible on first visit; dismissed by "Got it"; not shown again

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Static content (no CMS) | Hardcoded JSX | No content management needed for V1; legal text changes rarely |
| Single shared layout | `(legal)` route group | Consistent chrome across both pages; shares CSS |
| Both pages publicly accessible | No auth check | Users must be able to read the terms before creating an account |
| Content tone | Plain language | Small indie product; legal jargon creates friction without adding protection |
| Effective date | 2026-06-30 | Update before production launch if content changes |
| Cookie notice (not consent gate) | Informational notice, not a blocking banner | Only strictly necessary cookies are used in V1; GDPR does not require consent for them. Notice is informational only. |
| Notice dismissal stored in `localStorage` | `cookie-consent=acknowledged` key | Avoids another cookie for cookie consent; survives page reloads |
| Marketing site legal links | Point to `{WEB_APP_URL}/terms` etc. | Legal pages live in `apps/web`, not `apps/website`; the marketing site has no separate legal pages |

---

## V2 Items

- Localisation of legal text (if the product expands to jurisdictions requiring translated disclosures)
- Version history / change log for terms

---

## Out of Scope

- Cookie consent gate / blocking modal (not required for strictly necessary cookies under GDPR/PECR)
- Separate legal pages in `apps/website` (links point to `apps/web` pages)
