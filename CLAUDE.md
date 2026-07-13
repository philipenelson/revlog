# Revlog — Development Rules

## Style Architecture (non-negotiable)

### Rule A — Design tokens live only in `packages/ui/tokens/src/`

Never define raw color, spacing, radius, or typography values anywhere outside this package. That means no hex codes, no `rgb()`, no hardcoded pixel values for spacing/radius in:
- CSS files (including `globals.css` — it must reference `var(--token-name)` only)
- Component or screen files (`.tsx`, `.ts`)
- Any other package or app

The web app's `globals.css` translates token values into CSS custom properties and bridges them into Tailwind via `@theme inline`. Until the CSS generation step is automated, keep `globals.css` in sync with the token package manually — but the token package is always the source of truth.

### Rule B — No inline styles in components or screens

Never use the `style={{}}` prop in JSX/TSX files. Use:
- **Tailwind utility classes** (`className`) for anything expressible as a utility
- **CSS Modules** (`.module.css` co-located with the component) for styles that need dynamic selectors, pseudo-elements, or cannot be expressed as Tailwind classes

Both rules are enforced by automated checks — see Guardrails below.

---

## Guardrails

### ESLint — no inline `style` prop
`apps/web/eslint.config.mjs` includes a `no-restricted-syntax` rule that errors on any `style=` attribute in JSX. This fires on `pnpm lint`.

### Pre-commit hook — no raw token values outside `packages/ui/tokens`
`scripts/pre-commit` runs on every `git commit`. It scans staged `.ts`, `.tsx`, and `.css` files (excluding `packages/ui/tokens/src/`) for raw hex color patterns and fails the commit if any are found.

Run `pnpm hooks` from the repo root after cloning to install the hook:
```
pnpm hooks
```

---

## Documentation (non-negotiable)

Documentation comes **before** implementation. Nothing gets built without a document first.

### Architecture decisions → ADR

Every decision about the stack, infrastructure, or technical approach requires an ADR in `docs/adr/`. This includes libraries chosen, patterns adopted, tools selected, and significant trade-offs made. Use the existing ADR format. No ADR = the decision didn't happen.

### Features → Spec with use cases and acceptance criteria

Every feature requires a spec file in `docs/specs/<area>/<feature>.md` before any code is written. The spec must include:
- **Use cases** — who does what, under what precondition, and what happens
- **Acceptance criteria** — a checklist of testable conditions that define "done"
- **Decisions** — significant choices made for this feature and why
- **V2+ items** — anything explicitly deferred, with rationale

Organize specs into subfolders by feature area (e.g. `docs/specs/auth/`, `docs/specs/garage/`).

### Use cases → Milestone

Every use case must appear in at least one milestone file in `docs/milestones/`. A use case can appear in multiple milestones when it is being iterated on (e.g. basic version in V1, enhanced version in V2). Milestones are the source of truth for what is in scope for a given release.

There are no exceptions to any of the above. Documentation is a first-class deliverable.

---

## Testing (non-negotiable)

### Every UI change requires an E2E test

Any change that affects the user interface must be covered by a Cypress E2E test in `apps/web/cypress/e2e/`. The test must cover:
- The primary happy path for the changed screen or component
- Any error states introduced or modified

### Every API service and route requires unit tests

Every service method and route handler in `apps/api` must have a Vitest unit test covering the primary happy path and all guard clauses (error conditions, validation failures). Run with `pnpm --filter @maintenance-log/api test`. See `apps/api/CLAUDE.md` for what to test and what not to test.

### A feature is not done without automated tests

"Done" means: spec written, code merged, and automated tests passing. A feature with no test is not done, regardless of how the UI looks. This applies to every screen, every form, and every interactive behaviour.

---

## Input handling (non-negotiable)

All string input from external sources (request bodies, query params) must be sanitized at the validation boundary before reaching service methods:

- **Email fields** — trim whitespace, normalize to lowercase
- **Name and text fields** — trim whitespace
- **Passwords** — never trim; spaces in passwords are intentional and valid
- **All fields** — enforce a maximum length appropriate to the field

Sanitization is applied via Zod transforms in `packages/domain/src/schemas/` (for request bodies) and in the route handler for query params. Nothing arrives at a service method unsanitized.

---

## Observability (non-negotiable)

### Logging

Every module that performs I/O, handles requests, or runs background work must emit structured log entries via the shared `logger` (`apps/api/src/lib/logger.ts`). Log levels must be appropriate:
- `error` — unhandled exceptions, failed operations that affect the user
- `warn` — recoverable issues, unexpected-but-handled conditions
- `info` — lifecycle events (server start, DB connection, request completed)
- `debug` — query details, intermediate state useful for debugging

The log level is controlled by the `LOG_LEVEL` environment variable (default: `info`). Never use `console.log` or `console.error` in application code — use the logger.

**V2 — OpenTelemetry across all apps.** Pino structured logs are V1's observability floor. In V2, OpenTelemetry adds distributed tracing (API + web), Prisma query spans, and log/trace correlation via `trace_id`. The `logger` interface stays the same; the transport changes. See `docs/milestones/v2.md` — Observability.

### Error handling

Every route and async operation must have explicit error handling. Rules:
- Express route handlers must pass errors to `next(err)` — never swallow them silently
- All `async` route handlers must be wrapped so unhandled promise rejections reach the Express error middleware
- The global error middleware (`apps/api/src/adapters/http/middleware/error.ts`) is the single place where errors are mapped to HTTP responses and logged
- Never expose raw error messages or stack traces to API clients in production — map to safe, generic messages
- Error boundaries in React (`apps/web`) must be present at the page level to prevent full-app crashes from component errors

---

## Workflow

### Implementation is step-by-step

Complete one logical step, confirm the goal was achieved, commit the changes, then move to the next step. Never batch multiple steps into a single commit unless explicitly asked.

### Never commit directly to `main`

All work happens on a worktree branch. Never `git commit`, `git merge`, or `git push` directly to `main` unless the user explicitly asks for that in the current request — a standing "yes" from an earlier session doesn't carry over. Default close-out is a pushed branch + an opened PR, left for the user to merge.

### Close every plan with a session summary and a PR

When a plan is complete, write a session summary to `docs/past_sessions/<date>-<topic>.md` covering the goal, key decisions, what was built (with commit references), verification performed, and what's explicitly out of scope — see existing files in that folder for the format. Commit it on the worktree branch, push, and open a PR — do not merge into `main` yourself.

---

## Domain

Product name in the UI is **Revlog**. Internal package namespace remains `maintenance-log`. See `CONTEXT.md` for full domain language glossary.
