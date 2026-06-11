# Session: Web App MVVM Refactor

**Date:** 2026-06-11
**Branch:** worktree-mvvm-refactor → main

---

## Goal

Refactor `apps/web` to the MVVM pattern with an Application / Model / Infrastructure layering: no logic in screens or layouts (all behaviour in viewmodel hooks), reusable components extracted to a common folder, utils and services extracted, and the existing Cypress E2E suites used as the regression harness throughout.

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Architecture | MVVM; `app/` (route shells) → `application/` (views + viewmodels) → `model/` (types + services) → `infrastructure/` (http, logging, media), plus pure `utils/` | Documented in ADR 0020; one-way dependency direction, behaviour testable without rendering |
| ViewModels | React hooks (`use<Screen>ViewModel`) returning data + callbacks, never JSX | Hooks are the natural testable seam; framework-agnostic classes would need a store abstraction V1 doesn't need |
| Services | One per aggregate (`auth`, `vehicle`, `insurance`, `logEntry`, `onboarding`); sole owners of API paths, auth headers, payload shapes | Screens/viewmodels never call `apiFetch` directly; `model/errors.ts` re-exports `ApiError` so 4xx/5xx classification doesn't reach into infrastructure |
| Shared components with per-screen sizing | `Wordmark`/`FormField` take the host screen's CSS-module object as a `classes` prop; icons take a `size` prop matching original call sites | Zero visual regression during the refactor; consolidating duplicated CSS deferred (per ADR 0007 token rules) |
| DOM refs | Stay in views; viewmodel callbacks accept the element (e.g. `removePhoto(fileInput)`) | `react-hooks/refs` taints any hook return value containing a ref; refs are a view concern anyway |
| Draft validation | `model/validation/vehicleDraft.ts` with `enforceYearRange` option | Preserves the intentional difference: add/edit enforce 1900..current+1, onboarding only requires numeric |
| Cypress vs app tsconfig | Excluded `cypress/` from `apps/web/tsconfig.json` | Spec files are script-scoped and redeclare consts across files; this pre-existing failure broke `next build` on main. Cypress compiles its own specs |

---

## What Was Built

- ADR 0020 — MVVM + layered architecture for the web app (de7bcd2)
- `src/infrastructure/` — apiClient (was `lib/api.ts`), logger, media store moved verbatim (d9c8963)
- `src/model/` — shared domain types, services per aggregate, draft validation, `errors.ts`; `AuthProvider` → `application/providers`, `routeForAccountStatus` → `application/navigation` (f3fe555)
- `src/utils/` (format/date/file) + `application/components/` (icons, GoogleIcon, Wordmark, FormField, StatusOrb) (1dfeed3)
- MVVM per screen, each as view + viewmodel under `application/screens/`, with routes reduced to re-exports:
  - login + verify-email, incl. shared `useLogScreenCrash` for error boundaries (5af3b62)
  - garage + add-vehicle (3f31f5e)
  - edit-vehicle (95aae29)
  - vehicle-detail, incl. `InsuranceDialog` view + viewmodel (c71e4cc)
  - onboarding (d358d5e)
  - log-entry form/new/edit, incl. `model/logEntryDraft.ts` (drafts, totals, payload mapping, OPFS media persistence) (160afd7)
- `apps/web/tsconfig.json` cypress exclusion (cdf5c4f); `apps/web/CLAUDE.md` architecture section + logger path update (previous commit)

---

## Verification

- Baseline before refactoring: full Cypress suite 130/130 green on `main`.
- After every commit: `pnpm type-check` (clean outside pre-existing cypress spec errors, fully clean after the tsconfig fix), `pnpm lint`, and the affected screen's spec(s).
- Final: full Cypress suite **130/130 green**, `pnpm lint` clean, `tsc --noEmit` clean, `next build` succeeds (it failed on `main` before the tsconfig fix).
- All `data-testid` attributes, copy, markup structure, and CSS-module class usage preserved verbatim.

---

## Out of Scope

- Consolidating the duplicated CSS-module rules across screens (FormField/Wordmark keep per-screen sizing via the `classes` prop).
- Unit tests for viewmodels/services (now possible; E2E covers behaviour today).
- The root `/` page (untouched Next.js template) and the mobile app.
- Automated dependency-direction enforcement (e.g. ESLint import boundaries) between layers.
