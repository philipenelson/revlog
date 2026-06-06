# Vitest for unit testing

## Context

The API needs a unit test framework that works with the TypeScript + ESM setup already in place (`tsx`, native ESM modules). Candidates evaluated:

**Jest + ts-jest** — the incumbent. Requires a separate transpilation pipeline (ts-jest or Babel), has well-known ESM compatibility issues, and carries significant configuration overhead for a TypeScript-first project.

**Vitest** — Jest-compatible API (same `describe`/`it`/`expect`/`vi` surface), native ESM and TypeScript support with no transpilation config, faster in-process test runner, and shares configuration format with the Vite ecosystem already adjacent via Next.js. Zero extra config to start.

## Decision

Vitest is the unit test runner for `apps/api`. Config lives in `apps/api/vitest.config.ts`.

Test files are co-located with the source they test (`*.test.ts`) and excluded from the production build via `tsconfig.json`.

`supertest` is the companion library for route-level tests — it mounts an Express app in-process and sends real HTTP requests without binding to a port.

## Trade-offs

- Vitest is not Jest. Teams occasionally hit gaps with libraries that mock Jest internals. No such libraries are in use here.
- Co-located test files increase source directory noise; the alternative (a separate `__tests__/` tree) makes imports more fragile. Co-location wins at this scale.
- No test database is configured for V1 unit tests — repository tests are deferred to integration tests that hit a real DB (future work).
