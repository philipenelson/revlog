# Marketing website: Astro, shared design tokens, static-first build

> **Renumbered 2026-07-10:** originally filed as ADR 0020, which collided with
> [ADR 0020 — Web MVVM layered architecture](0020-web-mvvm-layered-architecture.md). Moved to
> 0042 (the next free number) to make ADR numbers unique again. Content is unchanged;
> inbound references were updated to point here.

`apps/website` is the public marketing site for Revlog — a landing page covering the product, its features, the roadmap, and a newsletter signup, with a link into the real web app at `apps/web`. It is a separate app from `apps/web` (which remains the authenticated product) and from `apps/mobile` (which does not have a built UI yet).

**Framework:** Astro (already scaffolded at `apps/website`, `astro@^6.4.4`). Astro's static-first, zero-JS-by-default model fits a content-heavy marketing page far better than a full React app, and keeps the production bundle minimal. `output: 'static'` (Astro's default) is used — no SSR adapter. This keeps the site deployable to any static host (e.g. Vercel/Netlify/Cloudflare Pages static hosting, or a CDN) with no Node server to run in production.

**Styling — same token bridge as `apps/web`:** `packages/ui/tokens/src/tokens.css` remains the single source of truth (Rule A). `apps/website/src/styles/global.css` imports it directly (`@import "../../../../packages/ui/tokens/src/tokens.css"`) and re-declares the identical `@theme inline` block used in `apps/web/src/app/globals.css`, mapping `--surface-*`, `--text-*`, `--accent*`, `--border-*`, `--radius-*`, and font variables into Tailwind v4 utilities. Tailwind v4 is wired via the official `@tailwindcss/vite` plugin (the `@astrojs/tailwind` integration is deprecated for v4) — `vite: { plugins: [tailwindcss()] }` in `astro.config.mjs`, with `@import "tailwindcss"` at the top of `global.css`. No separate Tailwind config file, matching `apps/web`.

**Fonts — self-hosted via Fontsource:** Astro has no `next/font`. The same three families from [ADR 0005](./0005-design-system-and-visual-identity.md) — Outfit (display), DM Sans (body), Geist Mono (numerals/technical) — are loaded via `@fontsource-variable/outfit`, `@fontsource-variable/dm-sans`, and `@fontsource-variable/geist-mono`, imported once in `global.css`. Each package's variable font is mapped to the same `--font-outfit`, `--font-dm-sans`, `--font-geist-mono` custom properties that `apps/web` exposes, so the shared `@theme inline` bridge resolves identically across both apps without re-deriving font stacks per-app.

**Web/mobile app showcase — living mockups, not screenshots:** The hero and feature sections recreate the approved screen designs (`docs/designs/revlog-garage-preview.html`, `revlog-vehicle-detail-preview.html`) as Astro/CSS "device frame" components built from the same design tokens, rather than embedding static raster screenshots. A pixel-screenshot pipeline would require a headless-browser step in the build and would go stale every time a screen's design changes; a token-driven recreation updates automatically when tokens change and costs no extra build tooling. The mobile app preview uses the same approach — `apps/mobile` has no built screens yet (Expo scaffold only), so its section is an illustrative phone-frame mockup in the same visual language, explicitly labeled "Coming soon" rather than presented as a real screenshot.

**Newsletter signups — existing API, no new backend:** The subscribe form POSTs to a new `POST /newsletter/subscribe` endpoint added to the existing `apps/api` (Express + Prisma + Zod + Pino, same layered routes/services/repositories architecture as auth — see `apps/api/CLAUDE.md`). This avoids adding an SSR adapter or a second backend runtime just to handle one form, and reuses the validation, logging, and error-handling infrastructure that already exists. The site reads the API's base URL from `PUBLIC_API_URL` (default `http://localhost:3001`) and the product app's URL from `PUBLIC_WEB_APP_URL` (default `http://localhost:3000`) — both are placeholders until production domains are decided (deployment is a separate, future decision).

**E2E testing:** Cypress, mirroring [ADR 0006](./0006-cypress-e2e-testing.md) — `apps/website/cypress/e2e/`, `data-testid` selectors, `cypress.config.ts` with `baseUrl` pointing at the Astro dev server.

## Status

accepted

## V2 consideration

- Replace the token-driven device-frame mockups with real product screenshots once a headless-browser screenshot pipeline is justified by a broader need (e.g. automated visual regression).
- Replace `PUBLIC_API_URL` / `PUBLIC_WEB_APP_URL` placeholder defaults with real production domains once hosting/deployment is decided (its own ADR).
- If the marketing site grows beyond a single landing page (blog, changelog, docs), revisit `output: 'static'` for content collections and incremental rendering needs.
