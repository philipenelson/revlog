# Session: Legal Pages

**Date:** 2026-06-30
**Branch:** worktree-legal-pages → main

---

## Goal

Implement the V1 legal prerequisites: Terms of Service, Privacy Policy, and Cookie Policy pages in `apps/web`; a dismissible cookie consent notice; real links in the login screen footer; and legal links in the marketing site footer. Spec: `docs/specs/website/legal.md`.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Static content (no CMS) | Hardcoded JSX | Legal text changes rarely; no CMS overhead justified in V1 |
| `(legal)` route group | Next.js route group, no layout chrome | Keeps legal pages at `/terms`, `/privacy`, `/cookies` without URL segment |
| Shared `LegalPageShell` | Single component wrapping header, content slot, and footer | Three pages share identical chrome; avoids duplication |
| Cookie notice vs. cookie gate | Informational dismiss-once banner, not a blocking modal | Only strictly necessary cookies used in V1; GDPR does not require consent for them |
| `dynamic({ ssr: false })` for `CookieConsent` | Lazy import with SSR disabled | `localStorage` is browser-only; avoids hydration mismatch and the `react-hooks/set-state-in-effect` lint rule; lazy `useState` initializer reads storage once on client mount |
| `WEB_APP_BASE_URL` in `apps/website/src/lib/env.ts` | Derived from `WEB_APP_URL` by stripping `/login` | `WEB_APP_URL` already points to the login page; adding a separate env var for the base URL avoided — computed instead |
| Marketing footer legal links | Point to `{WEB_APP_BASE_URL}/terms` etc. | Legal pages live in `apps/web`, not `apps/website`; no need for separate Astro legal pages |

---

## What Was Built

### Spec (`docs(spec): legal pages` — 06542e2)

- **`docs/specs/website/legal.md`** — use cases (UC-LEGAL-1 through UC-LEGAL-5), content requirements for all three pages, layout spec, acceptance criteria, decisions

### Pages and components (`feat(web): legal pages` — f244c6f)

- **`apps/web/src/app/(legal)/layout.tsx`** — passthrough layout for the `(legal)` route group
- **`apps/web/src/app/(legal)/terms/page.tsx`** — `title: "Terms of Service – Revlog"`
- **`apps/web/src/app/(legal)/privacy/page.tsx`** — `title: "Privacy Policy – Revlog"`
- **`apps/web/src/app/(legal)/cookies/page.tsx`** — `title: "Cookie Policy – Revlog"`
- **`apps/web/src/application/screens/legal/LegalPageShell.tsx`** — shared header (Revlog wordmark + back-to-sign-in link) and footer (cross-links to other legal pages + copyright)
- **`apps/web/src/application/screens/legal/TermsScreen.tsx`** — eight sections: About, Eligibility, Your Data, Acceptable Use, Availability, Termination, Liability, Changes, Contact
- **`apps/web/src/application/screens/legal/PrivacyScreen.tsx`** — nine sections covering data collected, usage, retention, third-parties, GDPR rights, CCPA rights, cookies, changes, contact
- **`apps/web/src/application/screens/legal/CookiesScreen.tsx`** — six sections: what a cookie is, the single `refreshToken` cookie, no tracking, consent not required, how to clear, contact
- **`apps/web/src/application/screens/legal/legal.module.css`** — shared token-only styles for all three screens (no raw colour/spacing values)
- **`apps/web/src/application/components/CookieConsent.tsx`** — client-only dismissible banner; `localStorage` key `cookie-consent=acknowledged`; `data-testid="cookie-consent"` and `data-testid="cookie-consent-dismiss"`
- **`apps/web/src/application/components/CookieConsent.module.css`** — token-only styles for banner, text, dismiss button
- **`apps/web/src/app/layout.tsx`** — added `CookieConsent` via `dynamic({ ssr: false })`
- **`apps/web/src/application/screens/login/LoginScreen.tsx`** — replaced `href="#"` with `href="/terms"` and `href="/privacy"` in the footer
- **`apps/website/src/lib/env.ts`** — added `WEB_APP_BASE_URL` (derived from `WEB_APP_URL`)
- **`apps/website/src/components/Footer.astro`** — added legal nav row linking to `/terms`, `/privacy`, `/cookies` on `WEB_APP_BASE_URL`

### Tests (`test(web): E2E tests for legal pages` — 7b0e170)

- **`apps/web/cypress/e2e/legal.cy.ts`** — tests for all three page headings, back links, cross-footer links, login footer navigation, cookie consent visibility, dismiss persistence, and "Learn more" link

---

## Verification

- `pnpm --filter @maintenance-log/web type-check` — clean (0 errors)
- `pnpm --filter @maintenance-log/web lint` — clean (0 errors)
- Pre-commit hook passed on all three commits

---

## Out of Scope

- Running Cypress in CI (deferred to existing test strategy)
- Cookie consent gate / blocking modal (not required for strictly necessary cookies)
- Separate legal pages in `apps/website` (all three link to `apps/web`)
- Localised legal text
- Version history / change log for terms
