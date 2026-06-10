# Marketing Landing Page Spec

**Area:** Website
**Route:** `/` (apps/website)
**Status:** Planned
**Last updated:** 2026-06-10

---

## Overview

The Revlog marketing site (`apps/website`) is the public, unauthenticated landing page for the product — the first thing a prospective rider sees before signing up in `apps/web`. It introduces Revlog, highlights the core feature set, previews the product (web app, with a "coming soon" mobile app), shows what's planned for future releases, links into the real web app, and offers an email signup for development/release updates.

This spec covers a single page (`/`) built with Astro, reusing the dark "cockpit" design tokens and aesthetic established for `apps/web` (see [ADR 0005](../../adr/0005-design-system-and-visual-identity.md)) and the new marketing-site architecture in [ADR 0020](../../adr/0020-marketing-website.md). The web app preview and mobile app preview sections are recreated as token-driven "device frame" mockups based on the approved screen designs in `docs/designs/revlog-garage-preview.html` and `docs/designs/revlog-vehicle-detail-preview.html` — see ADR 0020 for why mockups are used instead of static screenshots.

The newsletter form submits to `POST /newsletter/subscribe` on `apps/api` — see [`newsletter-api.md`](./newsletter-api.md).

---

## Layout

- **Site nav** — sticky top bar with the Revlog wordmark/logo, in-page links (Features, Roadmap), and an "Open web app" button linking to `PUBLIC_WEB_APP_URL`
- **Hero** — eyebrow, large headline, supporting copy, primary CTA ("Open the web app") and secondary CTA ("Get updates", scrolls to the newsletter section), with a device-frame mockup of the Garage screen as the visual anchor
- **Features** — eyebrow + heading, followed by a grid of feature cards (icon, title, description) covering the Garage, service history/log entries, insurance tracking, entry types, owner-first data, and onboarding
- **Web app showcase** — eyebrow + heading + supporting copy, alongside two device-frame mockups recreating the Garage grid and Vehicle Detail screens
- **Mobile app showcase** — eyebrow + heading + supporting copy + "Coming soon" badge, alongside a phone-frame mockup in the same visual language
- **Roadmap** — eyebrow + heading, followed by a list of upcoming features drawn from the V2 milestone, written for a rider audience
- **Newsletter** — eyebrow + heading + supporting copy, an email input + submit button, with success / validation-error / server-error states
- **Footer** — wordmark, "Open web app" link, copyright line

---

## Use cases

### UC-WEBSITE-1 — View the hero and open the web app

**Actor:** Prospective rider visiting the marketing site
**Precondition:** None — page is public
**Milestones:** [V1](../../milestones/v1.md)

1. Visitor navigates to `/`
2. System renders the site nav and hero section: headline, supporting copy, a primary "Open the web app" CTA, a secondary "Get updates" CTA, and the Garage device-frame mockup
3. Visitor selects "Open the web app" (in the nav or hero)
4. System opens `PUBLIC_WEB_APP_URL` (the `apps/web` Garage/login flow) in the same tab

---

### UC-WEBSITE-2 — Browse feature highlights

**Actor:** Prospective rider
**Precondition:** Visitor is on `/`
**Milestones:** [V1](../../milestones/v1.md)

1. Visitor scrolls to (or selects "Features" in the nav, which jumps to) the Features section
2. System renders a heading and a grid of feature cards, each with an icon, title, and one-line description, covering: the Garage, permanent service history (Log Entries), insurance tracking, the seven Log Entry types, owner-owned data, and guided onboarding

---

### UC-WEBSITE-3 — Preview the web app

**Actor:** Prospective rider
**Precondition:** Visitor is on `/`
**Milestones:** [V1](../../milestones/v1.md)

1. Visitor scrolls to the web app showcase section
2. System renders a heading, supporting copy, and two device-frame mockups recreating the Garage grid and Vehicle Detail screens (built from the same design tokens as `apps/web`, per [ADR 0020](../../adr/0020-marketing-website.md))

---

### UC-WEBSITE-4 — Preview the (in-development) mobile app

**Actor:** Prospective rider
**Precondition:** Visitor is on `/`
**Milestones:** [V1](../../milestones/v1.md)

1. Visitor scrolls to the mobile app showcase section
2. System renders a heading, supporting copy, a "Coming soon" badge, and a phone-frame mockup in the Revlog visual language
3. No claim is made that the mobile app exists or can be downloaded — copy and badge make clear it is in development (matches [V2 milestone](../../milestones/v2.md) — Mobile)

---

### UC-WEBSITE-5 — View what's coming next

**Actor:** Prospective rider
**Precondition:** Visitor is on `/`
**Milestones:** [V1](../../milestones/v1.md)

1. Visitor selects "Roadmap" in the nav (or scrolls to the section)
2. System renders a heading and a list of planned features written for a rider audience: fuel tracking, scheduled maintenance & due reminders, mechanic printout/exports, vehicle photos, mobile apps (iOS & Android), and faster sign-in (remember me & social login) — sourced from the [V2 milestone](../../milestones/v2.md)

---

### UC-WEBSITE-6 — Subscribe to development/release updates

**Actor:** Prospective rider
**Precondition:** Visitor is on `/`, with a working connection to the API
**Milestones:** [V1](../../milestones/v1.md)

1. Visitor scrolls to (or is taken to, via the hero's "Get updates" CTA) the newsletter section
2. Visitor enters their email address and submits the form
3. Client validates the email is non-empty and well-formed before sending
4. System sends `POST /newsletter/subscribe` (see [`newsletter-api.md`](./newsletter-api.md)) with the email
5. On success (200/201), the form replaces itself with a confirmation message ("You're subscribed — thanks for following along.") and the input is cleared
6. Submitting the same email again still succeeds (idempotent) and shows the same confirmation — see [`newsletter-api.md`](./newsletter-api.md) Decisions

---

### UC-WEBSITE-7 — Newsletter signup error states

**Actor:** Prospective rider
**Precondition:** Visitor is on the newsletter section
**Milestones:** [V1](../../milestones/v1.md)

1. Visitor submits the form with an empty or malformed email
2. System shows an inline validation message ("Enter a valid email address.") without contacting the API
3. Visitor submits a well-formed email, but the API request fails (network error or 5xx)
4. System shows an inline error message ("Something went wrong. Try again in a moment.") and leaves the entered email in place so the visitor can retry

---

## Acceptance Criteria

### Site nav

- [ ] Sticky top bar renders the Revlog wordmark/logo, "Features" and "Roadmap" links that scroll to their sections, and an "Open web app" button linking to `PUBLIC_WEB_APP_URL`
- [ ] Page `<title>` is "Revlog — Your bike's service history, for life."

### Hero

- [ ] Renders an eyebrow, headline, supporting copy, a primary "Open the web app" CTA (`PUBLIC_WEB_APP_URL`), and a secondary "Get updates" CTA that scrolls to the newsletter section
- [ ] Renders a Garage-grid device-frame mockup as the hero visual

### Features

- [ ] Renders a heading and a grid of feature cards (icon, title, description); covers Garage, service history/Log Entries, insurance, the seven Log Entry types, owner-owned data, and onboarding
- [ ] Domain language matches [`CONTEXT.md`](../../../CONTEXT.md): "Vehicle," "Garage," "Owner," "Log Entry" — never "fleet," "inventory," or "bike/motorbike" in code-facing strings (informal "bike" copy is fine in marketing prose)

### Web app showcase

- [ ] Renders a heading, supporting copy, and two device-frame mockups recreating the Garage grid and Vehicle Detail screens, built with the shared design tokens (no raw hex/px values — see Rule A)

### Mobile app showcase

- [ ] Renders a heading, supporting copy, a visible "Coming soon" badge, and a phone-frame mockup in the Revlog visual language
- [ ] No download links or app-store badges are rendered (mobile app does not exist yet)

### Roadmap

- [ ] Renders a heading and a list of planned features (fuel tracking, scheduled maintenance & due reminders, mechanic printout/exports, vehicle photos, mobile apps, faster sign-in) matching the [V2 milestone](../../milestones/v2.md)

### Newsletter form

- [ ] Renders an email input and a submit button with supporting copy
- [ ] Empty or malformed email on submit shows an inline validation message and does not call the API
- [ ] Valid email on submit calls `POST /newsletter/subscribe`; on success the form is replaced with a confirmation message and the input is cleared
- [ ] Resubmitting the same email shows the same confirmation (idempotent — see [`newsletter-api.md`](./newsletter-api.md))
- [ ] A failed request (network error or 5xx) shows an inline error message and preserves the entered email for retry

### Footer

- [ ] Renders the Revlog wordmark, an "Open web app" link to `PUBLIC_WEB_APP_URL`, and a copyright line

### General

- [ ] No raw hex colors, spacing/radius px values, or `style={{}}`/`style=` attributes anywhere in `apps/website` outside `packages/ui/tokens/src/` (Rules A & B)
- [ ] All three Revlog font families (Outfit, DM Sans, Geist Mono) render via self-hosted Fontsource packages, matching `apps/web`'s typography

### E2E tests (Cypress)

- [ ] Landing page renders the nav, hero (headline + both CTAs + mockup), features grid, web app showcase, mobile app showcase with "Coming soon" badge, roadmap list, newsletter form, and footer
- [ ] "Open the web app" (nav, hero, and footer) link to `PUBLIC_WEB_APP_URL`
- [ ] "Get updates" CTA scrolls to the newsletter section
- [ ] Newsletter form: submitting an invalid email shows the validation message and does not call the API (asserted via `cy.intercept`)
- [ ] Newsletter form: submitting a valid email calls `POST /newsletter/subscribe` (stubbed via `cy.intercept`) and shows the confirmation message
- [ ] Newsletter form: a stubbed 500 response shows the error message and preserves the entered email

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Visual showcase approach | Token-driven "device frame" mockups recreating `docs/designs/revlog-garage-preview.html` and `revlog-vehicle-detail-preview.html`, instead of static screenshots | See [ADR 0020](../../adr/0020-marketing-website.md) — avoids a headless-browser screenshot pipeline and keeps visuals in sync with token changes |
| Mobile app section | Illustrative phone-frame mockup, explicitly labeled "Coming soon" | `apps/mobile` has no built screens yet (Expo scaffold only — [V2 milestone](../../milestones/v2.md)); avoids implying a downloadable app exists |
| Roadmap content | Drawn from [V2 milestone](../../milestones/v2.md), rewritten in user-facing language (e.g. "Scheduled maintenance & due reminders" for "Scheduled maintenance items with mileage/time triggers") | Keeps the public roadmap honest and traceable to the actual backlog without exposing internal/technical items (e.g. OpenTelemetry) |
| "Open the web app" destination | `PUBLIC_WEB_APP_URL` env var, default `http://localhost:3000` | Production domain not yet decided — placeholder per [ADR 0020](../../adr/0020-marketing-website.md) |
| Newsletter backend | New `POST /newsletter/subscribe` on existing `apps/api` (see [`newsletter-api.md`](./newsletter-api.md)) | Reuses existing validation/logging/testing infrastructure; avoids a second backend or SSR adapter — see [ADR 0020](../../adr/0020-marketing-website.md) |
| Feature copy source | `CONTEXT.md` domain glossary + approved screen designs | Keeps marketing copy aligned with in-product terminology |

---

## Next steps (tracked follow-up)

### Real product screenshots
Once the web app's Garage and Vehicle Detail screens are visually stable and a screenshot pipeline is justified elsewhere (e.g. visual regression testing), replace the device-frame mockups with real captures — see [ADR 0020](../../adr/0020-marketing-website.md) V2 consideration.

### Production domains
Replace `PUBLIC_WEB_APP_URL` / `PUBLIC_API_URL` placeholder defaults once hosting/deployment is decided.

---

## Out of scope

- Blog, changelog, or documentation pages (single landing page only)
- Localization / multi-language content
- Light theme (site is dark-only, matching `apps/web` — [ADR 0005](../../adr/0005-design-system-and-visual-identity.md))
- Authentication or any account-related functionality (purely public marketing)
- Double opt-in / unsubscribe flows for the newsletter (see [`newsletter-api.md`](./newsletter-api.md) Out of scope)
