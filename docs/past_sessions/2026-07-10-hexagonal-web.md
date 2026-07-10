# Session: Hexagonal (Ports & Adapters) rearchitecture — Web

## Goal

Bring the web app under the same Hexagonal (Ports & Adapters) vocabulary just adopted for
the API (ADR 0039). Second of three apps; mobile follows in its own session/ADR.

Unlike the API, the web app was already **~80% hexagonal in substance** — MVVM three layers
(ADR 0020), services extracted to `packages/api-client` behind an `HttpClient` port
(ADR 0024), a `MediaStore` port + OPFS adapter (ADR 0019), and an interceptor-based
cross-cutting seam (ADR 0021/0022). So this was a **surgical rename + one leak fix**, not a
reorg.

## Key Decisions

- **Scope = surgical rename** (chosen by the user over docs-only and a full literal
  hexagon). Rename `infrastructure/` → `adapters/`; move the one web-private port into the
  core; keep views co-located with viewmodels.
- **Frontend hexagon, named honestly.** On the frontend the UI framework *is* the driving
  adapter, so the application layer (ViewModels) is React-bound and **not** framework-free —
  ADR 0040 states this plainly rather than pretending otherwise. Driving = `app/` routes +
  `application/screens/*` views; core = framework-free `domain/` + React-bound `application/`
  viewmodels; driven = `adapters/{http,media,logging,session}`.
- **Views stay co-located.** Not pulled into an `adapters/ui/` — screen cohesion
  (view + viewmodel + `.module.css`) and the component-consolidation spec outweigh folder
  literalism.
- **No web-local gateway ports over `api-client`.** ViewModels call service functions
  directly — those already sit behind the `HttpClient` port and are shared with mobile. A
  local gateway is warranted only surgically, per-feature, for an untrusted swappable
  third-party SDK or genuine cross-endpoint caching/orchestration — never as a global rule.
- **`HttpClient` port stays in `packages/api-client`** (cross-app contract, not web-private).
  `sessionStore`/`logger` stay concrete (single impl, no substitution seam → no port).

## What Was Built

- **ADR 0040** + rewritten `apps/web/CLAUDE.md` (hexagon vocabulary, `domain/ports/`, the
  gateway rule, `infrastructure/…` → `adapters/…` throughout). Root `CLAUDE.md` needed no
  change (it has no web `infrastructure` path reference). (`9539a54`)
- **`MediaStore` port into the core**: `git`-renamed `infrastructure/media/MediaStore.ts` →
  `domain/ports/MediaStore.ts` (100%), repointing `logEntryDraft.ts`, `OpfsMediaStore.ts`,
  `MediaStoreProvider.tsx`. Closes the `domain → infrastructure` dependency-direction leak;
  the adapter stays outside. (`69e7c9a`)
- **`infrastructure/` → `adapters/` rename**: `git mv src/infrastructure src/adapters`
  (8 files, blame preserved) + rewrote every `@/infrastructure/*` import to `@/adapters/*`
  across 18 files + two stale code comments. `"use client"` confirmed intact on
  `MediaStoreProvider.tsx`. (`419a887`)

## Verification

- `pnpm --filter @maintenance-log/web type-check` — a fresh, non-incremental **baseline vs.
  branch diff was byte-for-byte identical** (modulo the expected MediaStoreProvider path
  move): the hexagonal changes introduce **zero** new type errors.
- `pnpm --filter @maintenance-log/web lint` — clean at every step.
- **Dev smoke** (with `rm -rf .next` first, per the Next cache gotcha): `next dev` booted,
  `/login` → 200 and `/` → 200 (exercising `@/adapters/http`, `@/adapters/logging`,
  `@/adapters/media/MediaStoreProvider`), `/garage` → 307 (middleware redirect, no crash);
  **no module-resolution or compile errors** in the dev log.
- `git grep "@/infrastructure" apps/web/src` → nothing; the rename is fully web-internal
  (mobile's own `@/infrastructure` layer is a separate app, untouched; `packages/eslint-config`
  matches on `apps/web/src/**`, unaffected).

## Pre-existing issue found (NOT introduced here, NOT fixed here)

The web app does **not** `next build` clean on `origin/main`, independent of this refactor:
`tsc`/`next build` report ~38 React-19 type errors (e.g. `forgot-password/layout.tsx`,
provider/view `{children}`) caused by a **duplicate `@types/react@19.0.14`** resolution in
the monorepo (`React.ReactNode` vs the hoisted `@types/react` `ReactNode`). Proven
pre-existing: a clean baseline build fails at the identical spot with none of this session's
changes. Left untouched to keep the refactor scoped (mirrors the API pass leaving its 2
pre-existing test errors). Fixing it is a separate, monorepo-wide task (likely a pnpm
`@types/react` dedupe/override).

## Out of Scope / Follow-ups

- Mobile hexagonal pass (own ADR) — mobile keeps its `infrastructure/` layer until then.
- The pre-existing duplicate-`@types/react` build breakage (separate task).
- A ViewModel unit-test seam (extract hook logic to framework-free functions) — today
  ViewModels are covered only via Cypress.
- Physically separating views as driving adapters (`adapters/ui/`) — deliberately rejected.
- Web-local gateway ports over `api-client` — only if a real per-feature need appears.
