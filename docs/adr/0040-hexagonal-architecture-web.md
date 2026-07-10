# Hexagonal (Ports & Adapters) architecture for the web app

## Context

The web app's layering was shaped by MVVM (ADR 0020) and has since been refined by the
shared-api-client extraction (ADR 0024) and the client-media port (ADR 0019). This ADR
brings the web app under the same **Hexagonal (Ports & Adapters)** vocabulary just adopted
for the API (ADR 0039), so all apps name the *direction of dependencies* (driving vs. driven,
inside vs. outside) the same way.

An audit found the web app is already **~80% hexagonal in substance**, just not in name:

- **A one-way layered structure already exists**: `app → application → domain →
  infrastructure`, enforced by ADR 0020.
- **Driven ports already exist**: the `HttpClient` port lives in `packages/api-client`
  (ADR 0024, adapters `CookieHttpClient` on web / `TokenHttpClient` on mobile); the
  `MediaStore` port has an `OpfsMediaStore` adapter (ADR 0019).
- **Cross-cutting concerns are already inverted** into an async interceptor pipeline around a
  generic `apiFetch` transport (ADR 0021, 0022); React/Next stays thin.
- **Services are already shared, not app-local**: they were extracted to
  `packages/api-client` and are consumed by both web and mobile.

Two things kept it from being cleanly hexagonal in *name*:

1. **The driven side is called `infrastructure/`, not `adapters/`** — the one folder whose
   name doesn't declare which side of the boundary it sits on.
2. **One dependency-direction leak.** `src/domain/logEntryDraft.ts` (the framework-free core)
   imported the `MediaStore` **port** from `@/infrastructure/media/MediaStore`. It imported
   the port (not the adapter) and received it by parameter, so the only real defect was that
   the **port lived next to its adapter instead of in the core** — the same "ports live in
   the layer that needs them" issue ADR 0039 fixed for the API.

This ADR covers the **web app only**. The mobile app gets its own hexagonal pass under a
separate ADR. The MVVM decision (ADR 0020) is not reversed — it is *renamed* into hexagon
vocabulary and its rules carry over unchanged.

### Frontend hexagon — an honest divergence from the API

On the backend the core is plain-class services, fully framework-free. On the **frontend the
UI framework (React/Next) *is* the driving adapter**, so the application layer — the
ViewModels — are React hooks and are **not** framework-free. We name this plainly rather than
pretend otherwise:

- **Driving adapters** = `app/` routes + the `application/screens/*` **views**. They drive the
  core in response to user interaction.
- **Core** = `domain/` (framework-free: types, validation, draft→payload mapping) + the
  `application/` **ViewModels** (the application/orchestration layer, bound to React by
  design — this is the pragmatic concession the frontend makes).
- **Driven adapters** = `adapters/{http,media,logging,session}` — everything that talks to
  the outside world (our API, OPFS, the console, in-memory session).

## Decision

Reorganize `apps/web/src/` around the hexagon, changing names and one file location — **not**
behaviour.

### 1. Rename `infrastructure/` → `adapters/`

The driven side becomes `adapters/`, matching the API. Its four sub-adapters are unchanged in
content:

```
adapters/
  http/       apiClient.ts (generic transport + interceptor pipeline),
              CookieHttpClient.ts (HttpClient port adapter, ADR 0024),
              authInterceptor.ts (auth request/response interceptors, ADR 0021)
  media/      OpfsMediaStore.ts (MediaStore adapter), MediaStoreProvider.tsx,
              useMediaStore.ts (client-only React wiring; carry "use client")
  logging/    logger.ts
  session/    sessionStore.ts (in-memory access-token holder, ADR 0002)
```

The import alias is unchanged (`@/*` → `./src/*`); only the folder name and the
`@/infrastructure/*` → `@/adapters/*` import paths change.

### 2. Ports live in the core: move the `MediaStore` port to `domain/ports/`

The `MediaStore` port interface moves from `infrastructure/media/MediaStore.ts` to
`domain/ports/MediaStore.ts`. Its `OpfsMediaStore` adapter stays in `adapters/media/`. This
closes the `domain → infrastructure` leak: the core now defines the port it needs, and the
adapter (outside) implements it — dependencies point inward.

The `HttpClient` port stays in `packages/api-client` (shared with mobile, ADR 0024) — it is a
*cross-app* contract, not web-private, so it does not move into `apps/web`.

### 3. Layout after the pass

```
apps/web/src/
  app/                    Next.js routing shell (DRIVING — routes)          [unchanged]
  application/            Application layer (React-bound core)              [unchanged]
    screens/<screen>/     <Screen>.tsx (view, DRIVING) + use<Screen>ViewModel.ts
                          (application logic) + <screen>.module.css
    components/ providers/ navigation/ hooks/
  domain/                 Framework-free core
    ports/                MediaStore.ts            ← moved in from infrastructure/media/
    types.ts  logEntryDraft.ts  validation/
  adapters/               DRIVEN side               ← renamed from infrastructure/
    http/ media/ logging/ session/
  utils/                  pure helpers                                       [unchanged]
```

Dependency direction is one-way and inward: `app → application → domain`, with `adapters`
implementing the ports the core defines. Views stay co-located with their ViewModels (see §5).

### 4. No web-local gateway ports over `api-client`

ViewModels keep calling `@maintenance-log/api-client` service functions **directly**, passing
`cookieHttpClient`. Those functions already sit behind the `HttpClient` port and are shared
with mobile, so wrapping them in a second, web-local "gateway" port would be exactly the
inbound-port boilerplate ADR 0039 §4 rejected — a seam nobody exercises.

A web-local gateway is warranted **only surgically, per-feature**, when either:

- the client being wrapped is an **untrusted, swappable third-party SDK** (a raw Firebase or
  Stripe client you might replace with another vendor) — *not* the case for our own
  `api-client`; or
- a feature needs **complex frontend-specific caching or orchestration across multiple API
  endpoints** before the ViewModel sees the data — in which case add a specific local gateway
  for *that* feature, never as a global rule.

### 5. Views stay co-located with ViewModels

We deliberately do **not** pull the `application/screens/*` views into a physical
`adapters/ui/` folder, even though the view is formally the driving adapter. Screen cohesion
(view + viewmodel + `.module.css` in one folder) and the two-tier component model
(`docs/specs/web/component-consolidation.md`) are worth more than folder-level literalism. The
driving/driven roles are documented; only the driven side is physically named `adapters/`.

## Why not a full "views-as-adapters" split / gateway ports / a renamed alias

- **Views-as-adapters** — moving views into `adapters/ui/` shatters screen co-location and the
  component-consolidation spec for a naming purity nobody benefits from. Rejected.
- **Gateway ports** — see §4; indirection without a substitution seam.
- **Changing the `@/*` alias** — unnecessary; renaming the physical folder is enough, and a
  narrower alias would churn every import for no gain.

## Trade-offs

- One mostly-mechanical rename touching ~19 files' import paths (`@/infrastructure` →
  `@/adapters`). Mitigated by `git mv` (blame preserved) and an import-path-only rewrite.
- The core is **not** 100% framework-free — the ViewModels are React hooks. This is intrinsic
  to a frontend hexagon and is named openly (§Context) rather than papered over. The genuinely
  framework-free part (`domain/`) stays framework-free.
- No behaviour changes, so the existing Cypress suite is the regression guard; there is still
  no ViewModel unit-test seam (deferred — see V2+).

## Status

accepted

## Consequences

- New web features follow the hexagon: framework-free types/validation/ports in `domain/`,
  orchestration in `application/` ViewModels, and anything touching `fetch`/OPFS/`console`/
  session only in `adapters/`.
- `domain/ports/` is where web-private driven ports live; `adapters/` is the only place that
  imports browser/network transports. The `HttpClient` port remains cross-app in
  `packages/api-client`.
- ADR 0020 (MVVM) is preserved and re-expressed in hexagon vocabulary; ADR 0019 (MediaStore
  port) and ADR 0024 (HttpClient port) are the port/adapter precedents this formalizes.
- ADR 0021/0022 (interceptors, retry/timeout) are unchanged — the interceptor seam is the
  web's established Open/Closed extension point.

## V2+ items

- Mobile hexagonal pass (own ADR).
- A ViewModel unit-test seam — extracting hook logic into framework-free functions so the
  application layer is testable without a DOM (today ViewModels are covered only via Cypress).
- Optional consolidation of `api-client` wire DTOs vs. any future web domain models.
