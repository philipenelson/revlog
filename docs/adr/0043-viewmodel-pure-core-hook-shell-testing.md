# ViewModel testing: Pure Functional Core + Framework Hook Shell

## Context

Both frontends organise screens as MVVM: a `use<Screen>ViewModel` hook owns all behaviour and
the view is logic-free (ADR 0020 web, ADR 0023 mobile; renamed into the hexagon by ADR 0040/0041).
Until now the two apps tested viewmodels unevenly:

- **Mobile** had a hook-render harness (`apps/mobile/test/renderViewModel.tsx`, Jest +
  `@testing-library/react-native`) and tested viewmodels as hooks, but business logic often lived
  inline in the hook, so it could only be reached through a rendered component.
- **Web** had **no** viewmodel unit tests at all — only Cypress E2E covered that behaviour.

Inline hook logic is awkward to test (needs a DOM, a render, mocked providers) and slow to cover
exhaustively. We want the hard logic — validation, display calculations, data transforms, business
rules — reachable without any framework, while the hook stays idiomatic.

## Decision

Adopt one pattern for **both** apps: **Pure Functional Core, Framework Hook Shell.**

### 1. Pure functional core

Extract validations, conditional display calculations, data transformers, and business rules out
of the hook lifecycle into **stateless pure functions**. Pure = deterministic, no React, no I/O,
collaborators passed in as arguments.

**Where they live: module scope in the same file as the hook**, not a separate `<screen>.logic.ts`.
Declaring a function at module scope in `use<Screen>ViewModel.ts` (outside the `use...ViewModel`
function body) and exporting it already makes it pure, out of the React lifecycle, and directly
importable by its test. A separate per-screen file is orthogonal to purity and only splits one
screen's code across two files — cohesion cost for no gain. Extract to its **own module** only
when the logic is **genuinely shared across multiple screens**: those cross-cutting helpers have
no single screen to be cohesive with, so they live in `domain/` (e.g. `domain/apiError.ts`,
`domain/vehicleForm.ts`, `domain/logEntryForm.ts`).

### 2. Framework hook shell

`use<Screen>ViewModel.ts` stays an idiomatic React hook and acts strictly as a **coordination
layer**: it uses `useState`/`useEffect`/`useMemo` (and RHF, router, providers) **only** to bind the
pure functions to React's lifecycle, state, and event handlers. It contains orchestration, not
business rules. Views stay dumb — they render only what the viewmodel exposes.

### 3. Dual-layer testing

- **Pure logic** → unit-tested directly (a co-located `*.logic.test.ts` that imports the exported
  module-scope functions from the viewmodel file), zero framework overhead. This is where
  exhaustive branch coverage lives (it is fast and DOM-free).
- **Lifecycle coordination** → tested through a `renderViewModel` harness (web: vitest + jsdom +
  `@testing-library/react` `renderHook`/`render`; mobile: Jest + `@testing-library/react-native`).
  These verify state transitions, effects, and that RHF-bound handlers orchestrate the pure
  functions and collaborators correctly — not the business rules themselves (already covered above).

### 4. Tooling

- **Web** gains vitest (`environment: jsdom`), `@vitejs/plugin-react`, `@testing-library/react`, and
  a harness at `src/test/renderViewModel.tsx`. `pnpm --filter @maintenance-log/web test`.
- **Mobile** keeps its Jest setup and existing harness; the change there is adding the pure-core
  extraction + `*.logic.test.ts` files, so its viewmodels match the same shape.

## Why not

- **Test hooks only (no extraction)** — every logic branch would need a render + mocked providers;
  slow, and couples pure rules to the framework. The mobile app started this way and it made
  exhaustive coverage expensive.
- **A separate `<screen>.logic.ts` file per screen** — extracting to *module scope* is what makes a
  function pure and testable; putting it in its own file is orthogonal to that and just splits one
  screen's code across two files. Cohesion cost, no benefit. The pure functions live in the
  `use<Screen>ViewModel.ts` file at module scope. (The first cut of this ADR used per-screen
  `.logic.ts` files; they were inlined back after review — the split added nothing.)
- **Extract everything into a shared `domain/` module** — screen-specific pure logic (a screen's
  error-message mapping, its route resolution) is application-layer, not domain; keeping it in the
  screen's file keeps cohesion. Genuinely cross-screen helpers can still move to `domain/`/`utils/`.
- **A heavyweight component test per screen** — the view is logic-free by rule (ADR 0020/0023), so
  there is nothing in it worth unit-testing; Cypress/Appium cover the rendered whole.

## Trade-offs

- A viewmodel with little logic yields few or no exported pure functions; its coverage then comes
  from the hook-shell test alone. That is fine — the split is applied where logic exists, not forced.
- Two test files per logic-bearing screen instead of one. Accepted: the pure file is where the
  cheap, exhaustive coverage lives.

## Status

accepted

## Consequences

- New screens follow the pattern: pure core as exported module-scope functions in
  `use<Screen>ViewModel.ts` + their direct test; the hook is a
  shell with a `renderViewModel` test. Documented in `apps/web/CLAUDE.md` and `apps/mobile/CLAUDE.md`.
- Web has a real unit-test seam for the first time; Cypress remains the E2E guard.
- Both apps share one viewmodel-testing shape, differing only in the render library (react vs
  react-native).

## V2+ items

- A shared eslint rule could flag business logic (branching, calculations) living directly in a
  `use*ViewModel` hook body rather than a module-scope pure function.
