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

## Architecture — MVVM in three layers (non-negotiable)

The app follows MVVM with an Application / Model / Infrastructure layering — see [ADR 0020](../../docs/adr/0020-web-mvvm-layered-architecture.md). Dependency direction is one-way:

```
app (routes) → application (views + viewmodels) → domain (types + services) → infrastructure (http, logging, media)
```

```
src/
  app/                       ← Next.js routing shell ONLY: page.tsx re-exports a
                                screen; layout.tsx / error.tsx satisfy Next conventions
  application/
    screens/<screen>/        ← <Screen>.tsx (pure view) + use<Screen>ViewModel.ts
                                (all state, effects, handlers) + <screen>.module.css
    components/              ← shared presentational components (icons, Wordmark,
                                FormField, StatusOrb) — no business logic
    providers/               ← cross-screen state (AuthProvider)
    navigation/              ← route mapping helpers
    hooks/                   ← shared application hooks (e.g. useLogScreenCrash)
  domain/
    types.ts                 ← domain types shared across screens
    validation/              ← client-side draft validation
    services/                ← one service per aggregate; the ONLY place that knows
                                API paths, auth headers, and payload shapes
  infrastructure/
    http/apiClient.ts        ← apiFetch / ApiError (generic transport + async interceptor pipeline)
    logging/logger.ts        ← client logger
    media/                   ← MediaStore port + OPFS adapter (ADR 0019)
  utils/                     ← pure helpers (formatting, dates, files)
```

Rules:
- **Views are logic-free** — no `useEffect`, no fetching, no business rules; they render viewmodel output and wire callbacks.
- **ViewModels own behaviour** and return data + callbacks, never JSX. Keep DOM refs in the view; pass elements into viewmodel callbacks when needed.
- **Views never import services or the http client**; viewmodels never call `apiFetch` or build auth headers — that belongs to `domain/services`.
- Route groups use parentheses — `(auth)` groups login/register without adding a URL segment.

---

## HTTP client and interceptors

`infrastructure/http/apiClient.ts` (`apiFetch`) is a **generic transport** — it prefixes the API base URL, runs an async interceptor pipeline, sends the request, and parses the response into JSON or throws `ApiError`. It knows nothing about sessions, tokens, auth endpoints, or React. It only talks to our API today but must stay reusable for unauthenticated or third-party endpoints, so **never add auth/session conditionals (including `/auth/*` checks) to `apiFetch`**. See [ADR 0021](../../docs/adr/0021-proactive-access-token-refresh.md).

Cross-cutting HTTP behaviour is added as **interceptors**, never by editing `apiFetch` (Open/Closed):

- `registerRequestInterceptor(fn)` / `registerResponseInterceptor(fn)` — both `async`, both return an **unregister** function. Request interceptors transform `(path, init)`; response interceptors transform/observe `(res, path, init)`.
- **Auth** is two interceptors whose logic lives in `domain/services/authInterceptor.ts` (plain TS — the layer that owns API paths + auth headers): `authRequestInterceptor` attaches the Bearer token and proactively refreshes the access token before expiry (single-flight, skipping `/auth/*`); `createUnauthorizedInterceptor(onUnauthorized)` redirects on any 401 (a failed silent restore, a failed refresh, or a rejected token). `AuthProvider` only registers them and injects the navigation callback — React/Next stays thin.
- **Retry/timeout** is built into the client around the `sendRequest` seam (not a per-call wrapper): default-on for idempotent methods only (POST excluded to avoid duplicate writes), configurable per-call via `apiFetch(path, init, options)` and globally. See [ADR 0022](../../docs/adr/0022-http-client-retry-policy.md).

When you need new cross-cutting behaviour (tracing, logging, etc.), write an interceptor or wrap `sendRequest` — do not add branches to `apiFetch`.

---

## Forms

Use React Hook Form + Zod resolver. Validation schemas are imported from `@maintenance-log/domain` — the same schemas the API validates against. Never duplicate field rules.

---

## Client-side state

Access tokens are stored in React state (memory only) — never in `localStorage` or `sessionStorage`. This follows the XSS-safe pattern described in [ADR 0002](../../docs/adr/0002-custom-jwt-auth.md).

---

## Client-side logging

Never call `console.log`, `console.warn`, or `console.error` directly in component or page code.

Use the shared client logger at `apps/web/src/infrastructure/logging/logger.ts`:

```ts
import { logger } from '@/infrastructure/logging/logger';
logger.error('something went wrong', { context });
```

### V1 strategy — dev console, silent in production

The client logger is a thin wrapper:
- **Development** (`NODE_ENV !== 'production'`): forwards to `console.*` so you can debug locally
- **Production**: complete no-op — nothing reaches the browser console

There is no remote error tracking or telemetry service in V1. Component crashes are caught by page-level error boundaries, which display a user-facing error UI. Remote error tracking and telemetry are deferred to V2 using OpenTelemetry (see `docs/milestones/v2.md` — Observability section).

### What this means in practice

- Import `logger` from `@/infrastructure/logging/logger`, not from `console`
- Log sparingly on the client — prefer meaningful error states in the UI over console output
- Error boundaries are the primary mechanism for handling unexpected failures; they do not need to call `logger` in V1

---

## Error boundaries

Page-level error boundaries are required per the root `CLAUDE.md` observability rules. Every page under `src/app/` must be able to contain a component crash without taking down the entire app.
