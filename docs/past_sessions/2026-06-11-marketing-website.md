# Session: Marketing Website

**Date:** 2026-06-11
**Branch:** worktree-rustling-prancing-kernighan → main

---

## Goal

Build a public marketing site for Revlog at `apps/website`: a single landing page with a hero, feature highlights, web/mobile app previews, a roadmap, and a newsletter signup form wired to a new API endpoint — following the same design tokens as `apps/web`, with full documentation (ADR, spec, milestone) and Cypress E2E coverage.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Framework | Astro (`apps/website`, `astro@^6.4.4`), `output: 'static'` | Static-first, zero-JS-by-default model fits a content-heavy marketing page; no SSR adapter needed — see [ADR 0042](../adr/0042-marketing-website.md) |
| Styling | Same token bridge as `apps/web` — `packages/ui/tokens/src/tokens.css` imported directly, identical `@theme inline` block in `apps/website/src/styles/global.css`, Tailwind v4 via `@tailwindcss/vite` | Single source of truth for tokens (Rule A), no divergence between apps |
| Fonts | Self-hosted via `@fontsource-variable/{outfit,dm-sans,geist-mono}` | Astro has no `next/font`; matches `apps/web`'s three font families |
| Web/mobile app previews | Token-driven "device frame" / "phone frame" mockups recreating `docs/designs/revlog-garage-preview.html` and `revlog-vehicle-detail-preview.html`, not raster screenshots | Avoids a headless-browser screenshot pipeline; mockups stay in sync with token changes automatically |
| Mobile app section | Illustrative phone-frame mockup, explicitly labeled "Coming soon", no store badges | `apps/mobile` has no built screens yet (Expo scaffold only) |
| Newsletter backend | New `POST /newsletter/subscribe` on existing `apps/api` (Express/Prisma/Zod/Pino, same layered architecture) | Reuses existing validation/logging/error-handling; avoids a second backend or SSR adapter |
| Newsletter idempotency | `findByEmail` then conditional `create`; both 200 (existing) and 201 (new) return the same confirmation body | A repeat signup isn't an error from the visitor's perspective (UC-WEBSITE-6) |
| Cross-origin newsletter calls | Added `WEBSITE_URL` (default `http://localhost:4321`) to `apps/api`'s CORS `allowedOrigins`, alongside existing `APP_URL` | The website calls the API directly from the browser via `PUBLIC_API_URL`; needed for the form's `fetch()` to succeed cross-origin |
| Log entry type badge tokens | Added the full canonical 7-type `--type-*-bg` / `--type-*-color` set to `packages/ui/tokens/src/tokens.css`, matching `docs/designs/revlog-vehicle-detail-preview.html` | The vehicle-detail mockup needed all 7 entry types; additive only — `apps/web`'s pre-existing divergent `vehicle-detail.module.css` implementation was left untouched (separate, out-of-scope issue) |
| E2E framework | Cypress, mirroring [ADR 0006](../adr/0006-cypress-e2e-testing.md) — `apps/website/cypress/e2e/`, `data-testid` selectors, `cypress.config.ts` with `baseUrl` at the Astro dev server | Consistency with `apps/web`'s existing E2E conventions |

---

## What Was Built

### Documentation
- [ADR 0042](../adr/0042-marketing-website.md) — marketing website stack and architecture (783c2fd)
- [`docs/specs/website/landing-page.md`](../specs/website/landing-page.md) — UC-WEBSITE-1 through 7, acceptance criteria (783c2fd)
- [`docs/specs/website/newsletter-api.md`](../specs/website/newsletter-api.md) — `POST /newsletter/subscribe` contract (783c2fd)
- `docs/milestones/v1.md` — added and checked off the "Marketing site" section (783c2fd, this session)

### API (`apps/api`)
- `POST /newsletter/subscribe` — route, `NewsletterService`, `PrismaNewsletterRepository`, `NewsletterSubscriber` Prisma model + migration, `newsletterSubscribeSchema` (trim/lowercase/max-254/email) in `packages/domain` (ca30bda)
- Vitest unit tests for the route and service, covering the happy path, validation failures, and idempotent resubscribe (ca30bda)
- `apps/api/src/app.ts` — added `WEBSITE_URL` to CORS `allowedOrigins`; `apps/api/.env.example` updated (d1feed9)

### Website foundation (`apps/website`)
- Astro app scaffold, `astro.config.mjs`, token bridge in `src/styles/global.css`, self-hosted fonts, `Layout.astro`, `Header.astro`, `Footer.astro`, `Logo.astro`, `src/lib/env.ts` (`PUBLIC_WEB_APP_URL`, `PUBLIC_API_URL`) (af7b0b6)

### Landing page sections (`apps/website/src/components`)
- `Hero.astro`, `Features.astro` + `FeatureCard.astro` (6 cards), `WebAppShowcase.astro`, `MobileAppShowcase.astro`, `Roadmap.astro` (6 V2 items rewritten for riders), `Newsletter.astro` (cf574b9)
- Mockup components: `DeviceFrame.astro`, `PhoneFrame.astro`, `GarageMockup.astro`, `VehicleDetailMockup.astro`, `MobileGarageMockup.astro`, `icons/MotorcycleIcon.astro` (cf574b9)
- `packages/ui/tokens/src/tokens.css` — added the 7-type log-entry badge token set (cf574b9)
- `src/pages/index.astro` — assembled all sections (cf574b9)

### Newsletter form wiring (`apps/website`)
- `Newsletter.astro` — client-side `<script>`: email regex validation, `fetch(POST /newsletter/subscribe)`, success replaces the form with a confirmation and clears the input, network/5xx errors show an inline message and preserve the entered email, submit button disabled while in flight (d1feed9)

### E2E tests (`apps/website`)
- `cypress.config.ts` (`baseUrl: http://localhost:4321`), `cypress:open`/`cypress:run` scripts, `cypress` devDependency (754fc26)
- `cypress/e2e/landing-page.cy.ts` — page title, nav links, hero (headline/CTAs/mockup), "Get updates" scroll, features grid, web app showcase, mobile showcase ("Coming soon", no store links), roadmap (6 items), newsletter form presence, footer (754fc26)
- `cypress/e2e/newsletter.cy.ts` — empty/malformed email validation (no API call), successful subscribe (201) shows confirmation and hides the form, idempotent resubscribe (200) shows the same confirmation, 5xx response shows the error and preserves the entered email (754fc26)
- `apps/website/tsconfig.json` — excluded `cypress/` and `cypress.config.ts` from `astro check`, mirroring `apps/web`'s ESLint exclusion (754fc26)

### Guardrail fix
- `scripts/check-raw-tokens.mjs` — fixed a false positive in the Rule A pre-commit hex-color check: `(?![0-9a-fA-F])` matched `#fea`/`#roa` inside anchor strings like `href="#features"`/`"#roadmap"`; tightened to `(?!\w)` (754fc26)

---

## Verification

- `pnpm build` (apps/website) — 1 page built, no errors, after every section was added
- Full-page PDF render via headless Chrome — every section verified visually: header, hero, features (6 cards), web app showcase (both mockups, all 3 sample entry-type badges in correct colors), mobile showcase with phone frame + "Coming soon", roadmap (6 cards), newsletter form, footer
- CORS verified end-to-end: `OPTIONS`/`POST http://localhost:3001/newsletter/subscribe` with `Origin: http://localhost:4321` → `Access-Control-Allow-Origin: http://localhost:4321`, `201 Created`
- `npx cypress run --browser electron` (apps/website, dev server on :4321): **15/15 passing** (`landing-page.cy.ts` 10/10, `newsletter.cy.ts` 5/5)
- `pnpm --filter @maintenance-log/api test` (newsletter route + service): passing (from earlier task)
- Rule A/B compliance: no `style=`/`style={{}}` and no raw hex values in `apps/website/src` or `apps/website/cypress`
- Pre-commit hook (`scripts/pre-commit`) passed on every commit

---

## Out of Scope

- Real product screenshots — device-frame mockups are a deliberate V1 choice; revisit if a visual-regression screenshot pipeline is built (ADR 0042 V2 consideration)
- Production domains for `PUBLIC_WEB_APP_URL` / `PUBLIC_API_URL` / `WEBSITE_URL` / `APP_URL` — still `localhost` placeholders pending a deployment decision
- `apps/web`'s pre-existing divergent `vehicle-detail.module.css` entry-type colors — left untouched; only additive tokens were introduced
- Unsubscribe flow, double opt-in, and actual newsletter campaign sending — deferred to V2 per `newsletter-api.md`
- `apps/website` has no `@astrojs/check` installed yet, so `pnpm lint`/`pnpm type-check` (`astro check`) cannot run — pre-existing gap from the Astro foundation task, not introduced or fixed in this session
