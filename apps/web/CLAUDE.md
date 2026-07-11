# Web App — Architecture Rules

## Style (non-negotiable)

The web app enforces the two style rules from the root `CLAUDE.md` via automated checks. They are documented here for visibility.

### Rule A — Design tokens only

All colour, spacing, radius, and typography values must come from `packages/ui/tokens/src/`. Never write raw hex codes, `rgb()`, or hardcoded pixel values for spacing or radius in:
- `globals.css` or any CSS file — must use `var(--token-name)` only
- Component or screen files (`.tsx`, `.ts`)

`src/app/globals.css` translates token values into CSS custom properties and bridges them into Tailwind via `@theme inline`. The token package is always the source of truth; keep `globals.css` in sync manually until generation is automated.

### Rule B — No inline styles

Never use `style={{}}` in JSX. This is enforced by the `no-restricted-syntax` ESLint rule in `eslint.config.mjs` — it will block `pnpm lint`.

Use instead:
- **Tailwind utility classes** (`className`) for anything expressible as a utility
- **CSS Modules** (`.module.css` co-located with the component) for pseudo-selectors, dynamic selectors, or styles that Tailwind cannot express

See [ADR 0007](../../docs/adr/0007-style-architecture-guardrails.md).

---

## Architecture — Hexagonal (Ports & Adapters) MVVM (non-negotiable)

The app is **Hexagonal (Ports & Adapters)** — see [ADR 0040](../../docs/adr/0040-hexagonal-architecture-web.md), which renames the MVVM layering of [ADR 0020](../../docs/adr/0020-web-mvvm-layered-architecture.md) into hexagon vocabulary (its rules are unchanged). Dependency direction is one-way and inward:

```
app → application → domain            (adapters implement the ports the core defines)
```

**Frontend hexagon roles** — on the frontend the UI framework *is* the driving adapter, so unlike the API the application layer is React-bound (this is named openly, not hidden):
- **Driving adapters** — `app/` routes + the `application/screens/*` **views** (they drive the core on user interaction).
- **Core** — `domain/` (framework-free: types, validation, draft→payload mapping, driven **ports**) + the `application/` **ViewModels** (application/orchestration logic, bound to React by design).
- **Driven adapters** — `adapters/{http,media,logging,session}`: the only code that touches `fetch`, OPFS, `console`, or the in-memory session.

API services (`authService`, `vehicleService`, etc.) do **not** live in the app — they were extracted to the shared `packages/api-client` workspace package so mobile consumes the same service functions (ADR 0024).

```
src/
  app/                       ← Next.js routing shell ONLY (DRIVING): page.tsx re-exports a
                                screen; layout.tsx / error.tsx satisfy Next conventions
  application/               ← application layer (React-bound core)
    screens/<screen>/        ← <Screen>.tsx (view, DRIVING) + use<Screen>ViewModel.ts
                                (all state, effects, handlers) + <screen>.module.css
    components/              ← shared presentational components (icons, Wordmark,
                                FormField, StatusOrb) — no business logic
    providers/               ← cross-screen state (AuthProvider)
    navigation/               ← route mapping helpers
    hooks/                   ← shared application hooks (e.g. useLogScreenCrash)
  domain/                    ← framework-free core
    ports/                   ← driven port interfaces (MediaStore) — the core defines
                                what it needs; adapters/ implement it
    types.ts                 ← client-only types (form drafts, display helpers) —
                                API-facing types live in packages/api-client
    logEntryDraft.ts         ← draft → API-payload mapping (depends on domain/ports/MediaStore)
    validation/              ← client-side draft validation
  adapters/                  ← DRIVEN side (the "outside")
    http/apiClient.ts        ← apiFetch / sendRequest (generic transport + async
                                interceptor pipeline; ApiError/TimeoutError come
                                from packages/api-client)
    http/CookieHttpClient.ts ← HttpClient port adapter (ADR 0024) wrapping apiFetch;
                                cookie-based auth is transparent to it
    http/authInterceptor.ts  ← auth request/response interceptors (CookieHttpClient-
                                specific wiring, not a portable service)
    media/                   ← OpfsMediaStore (implements domain/ports/MediaStore) +
                                MediaStoreProvider/useMediaStore ("use client") (ADR 0019)
    logging/logger.ts        ← client logger
    session/sessionStore.ts  ← in-memory access-token holder (ADR 0002)
  utils/                     ← pure helpers (formatting, dates, files)
```

Rules:
- **Views are logic-free** — no `useEffect`, no fetching, no business rules; they render viewmodel output and wire callbacks.
- **ViewModels own behaviour** and return data + callbacks, never JSX. Keep DOM refs in the view; pass elements into viewmodel callbacks when needed.
- **Views never import services or the http client**; viewmodels never call `apiFetch` or build auth headers — that belongs to `packages/api-client` services, called with the `cookieHttpClient` instance from `adapters/http/CookieHttpClient.ts`.
- **Driven ports live in the core** (`domain/ports/`); their adapters live in `adapters/`. The `HttpClient` port is the exception — it is a cross-app contract and stays in `packages/api-client` (ADR 0024).
- **No web-local gateway ports over `api-client`.** ViewModels call `api-client` service functions directly — those already sit behind the `HttpClient` port and are shared with mobile, so a second wrapping port is boilerplate. Introduce a local gateway **only surgically, per-feature**, when wrapping an untrusted swappable third-party SDK (not our api-client) or when a feature needs complex frontend-specific caching/orchestration across multiple endpoints — never as a global rule. See ADR 0040 §4.
- Route groups use parentheses — `(auth)` groups login/register without adding a URL segment.

---

## HTTP client and interceptors

`adapters/http/apiClient.ts` (`apiFetch`) is a **generic transport** — it prefixes the API base URL, runs an async interceptor pipeline, sends the request, and parses the response into JSON or throws `ApiError` (imported from `@maintenance-log/api-client`). It knows nothing about sessions, tokens, auth endpoints, or React. It only talks to our API today but must stay reusable for unauthenticated or third-party endpoints, so **never add auth/session conditionals (including `/auth/*` checks) to `apiFetch`**. See [ADR 0021](../../docs/adr/0021-proactive-access-token-refresh.md).

`adapters/http/CookieHttpClient.ts` is the `HttpClient` port adapter (ADR 0024): it wraps `apiFetch` and serializes request bodies (JSON, or passes `FormData` through untouched) so `packages/api-client` services never call `JSON.stringify` themselves. Every viewmodel that calls a service passes `cookieHttpClient` as the first argument.

Cross-cutting HTTP behaviour is added as **interceptors**, never by editing `apiFetch` (Open/Closed):

- `registerRequestInterceptor(fn)` / `registerResponseInterceptor(fn)` — both `async`, both return an **unregister** function. Request interceptors transform `(path, init)`; response interceptors transform/observe `(res, path, init)`.
- **Auth** is two interceptors whose logic lives in `adapters/http/authInterceptor.ts` (plain TS, CookieHttpClient-specific — not part of the portable `packages/api-client` services): `authRequestInterceptor` attaches the Bearer token and proactively refreshes the access token before expiry (single-flight, skipping `/auth/*`); `createUnauthorizedInterceptor(onUnauthorized)` redirects on any 401 (a failed silent restore, a failed refresh, or a rejected token). `AuthProvider` only registers them and injects the navigation callback — React/Next stays thin.
- **Retry/timeout** is built into the client around the `sendRequest` seam (not a per-call wrapper): default-on for idempotent methods only (POST excluded to avoid duplicate writes), configurable per-call via `apiFetch(path, init, options)` and globally. See [ADR 0022](../../docs/adr/0022-http-client-retry-policy.md).

When you need new cross-cutting behaviour (tracing, logging, etc.), write an interceptor or wrap `sendRequest` — do not add branches to `apiFetch`.

---

## Forms

Use React Hook Form + Zod resolver. Validation schemas are imported from `@maintenance-log/domain` — the same schemas the API validates against. Never duplicate field rules.

---

## ViewModel testing — Pure Functional Core + Framework Hook Shell (non-negotiable)

ViewModels follow **Pure Functional Core, Framework Hook Shell** (ADR 0043), the same pattern as mobile. Run with `pnpm --filter @maintenance-log/web test` (vitest + jsdom).

- **Pure functional core** — extract validations, conditional display calculations, data transformers, and business rules into **stateless pure functions** (no React, no I/O; collaborators passed as args). Declare them at **module scope in the same `use<Screen>ViewModel.ts` file** (outside the hook body) and export them — *not* a separate `<screen>.logic.ts`, which just splits one screen's code for no gain. Only when logic is **shared across multiple screens** does it move to its own module in `domain/` (e.g. `domain/apiError.ts`, `domain/vehicleForm.ts`). Unit-test the pure functions **directly** — this is where exhaustive branch coverage lives.
- **Hook shell** — the `use<Screen>ViewModel` function stays an idiomatic hook that uses `useState`/`useEffect`/`useMemo` (+ RHF/router/providers) **only** to bind those pure functions to React's lifecycle and handlers. No business rules inline in the hook body.
- **Hook-shell tests** — `use<Screen>ViewModel.test.tsx` uses the harness at `@/test/renderViewModel` (`renderHook` for logic-only hooks; `renderViewModelForm` to drive RHF `register`-bound submit paths) to verify state transitions, effects, and handler orchestration — not the business rules (already covered by the pure tests).
- **Views stay dumb** — components are logic-free and are not unit-tested; Cypress covers the rendered whole.

Example: `application/screens/login/useLoginViewModel.ts` exports `safeNextPath`, `resolvePostAuthRoute`, `verifyEmailRoute` (module scope) alongside the hook; `login.logic.test.ts` imports them from the viewmodel; `useLoginViewModel.test.tsx` covers the shell. Shared error helpers come from `@/domain/apiError`.

---

## Client-side state

Access tokens are stored in React state (memory only) — never in `localStorage` or `sessionStorage`. This follows the XSS-safe pattern described in [ADR 0002](../../docs/adr/0002-custom-jwt-auth.md).

---

## Client-side logging

Never call `console.log`, `console.warn`, or `console.error` directly in component or page code.

Use the shared client logger at `apps/web/src/adapters/logging/logger.ts`:

```ts
import { logger } from '@/adapters/logging/logger';
logger.error('something went wrong', { context });
```

### V1 strategy — dev console, silent in production

The client logger is a thin wrapper:
- **Development** (`NODE_ENV !== 'production'`): forwards to `console.*` so you can debug locally
- **Production**: complete no-op — nothing reaches the browser console

There is no remote error tracking or telemetry service in V1. Component crashes are caught by page-level error boundaries, which display a user-facing error UI. Remote error tracking and telemetry are deferred to V2 using OpenTelemetry (see `docs/milestones/v2.md` — Observability section).

### What this means in practice

- Import `logger` from `@/adapters/logging/logger`, not from `console`
- Log sparingly on the client — prefer meaningful error states in the UI over console output
- Error boundaries are the primary mechanism for handling unexpected failures; they do not need to call `logger` in V1

---

## Error boundaries

Page-level error boundaries are required per the root `CLAUDE.md` observability rules. Every page under `src/app/` must be able to contain a component crash without taking down the entire app.
