# Web app: MVVM with Application / Model / Infrastructure layers

## Context

The web app grew screen-by-screen. Each `page.tsx` under `apps/web/src/app/` is a single client component that mixes every concern in one file:

- **Data access** — raw `apiFetch` calls with hand-built `Authorization` headers, response types declared inline per screen
- **State and behaviour** — load-state machines, form drafts, validation, submit handlers
- **Presentation** — JSX, presentational sub-components, CSS-module class composition
- **Duplicated building blocks** — `Logo`, `Wordmark`, `PlusIcon`, `ArrowIcon`, `Field`, date/currency formatters, and vehicle-draft validation are re-declared in up to five screens

The largest screen (`garage/[vehicleId]/page.tsx`) is ~890 lines. Duplication has already drifted (add/edit validate the year range, onboarding does not — intentional, but invisible). Nothing separates "what the screen does" from "how it looks", so behaviour cannot be changed or tested without touching markup, and vice versa.

## Decision

Adopt **MVVM** for screens, organized into three layers with a strict dependency direction:

```
app (routes) → application (views + viewmodels) → model (types + services) → infrastructure (http, logging, media)
```

### Directory layout

```
apps/web/src/
  app/                       ← Next.js routing shell ONLY (Application layer entry points)
    …/page.tsx               ← re-exports a screen; no logic, no markup beyond the screen
    …/layout.tsx, error.tsx  ← Next conventions; render shared components, no logic
  application/               ← Application layer
    screens/<screen>/
      <Screen>.tsx           ← View: pure render of viewmodel output; no fetching, no business rules
      use<Screen>ViewModel.ts← ViewModel: all state, effects, handlers; returns plain props
      <screen>.module.css    ← co-located styles (unchanged)
    components/              ← reusable view components (icons, Logo, Wordmark, StatusOrb,
                                FormField, error fallback) — presentational only
    providers/               ← cross-screen state holders (AuthProvider)
    navigation/              ← route mapping helpers (routeForAccountStatus)
  model/                     ← Model layer
    types.ts                 ← domain types shared across screens (VehicleSummary, VehicleDetail,
                                InsuranceRecord, LogEntry*, Session, drafts)
    validation/              ← client-side draft validation rules
    services/                ← one service per aggregate: authService, vehicleService,
                                insuranceService, logEntryService, onboardingService.
                                The ONLY place that knows API paths and payload shapes.
  infrastructure/            ← Infrastructure layer
    http/apiClient.ts        ← apiFetch / apiUpload / ApiError (transport only)
    logging/logger.ts        ← client logger (unchanged contract)
    media/                   ← MediaStore port + OPFS adapter + provider (ADR 0019, moved as-is)
  utils/                     ← pure, dependency-free helpers (date/currency formatting,
                                pluralize, file readers) usable from any layer
```

### Rules

1. **Views are logic-free.** A screen component receives everything it renders from its viewmodel (or props) and only wires callbacks to elements. No `useEffect`, no fetching, no branching beyond render conditionals on viewmodel state.
2. **ViewModels own behaviour.** All state machines, effects, validation calls, and service calls live in `use<Screen>ViewModel`. ViewModels return data and callbacks — never JSX.
3. **Services own the API surface.** Endpoint paths, request payload assembly, and response unwrapping live in `model/services`. ViewModels never call `apiFetch` directly and never build `Authorization` headers.
4. **Dependency direction is one-way.** `application` may import `model` and `utils`; `model` may import `infrastructure` and `utils`; `infrastructure` imports nothing above it. Views import viewmodels and components — never services or the http client.
5. **Routes are shells.** Files under `src/app/` only satisfy Next.js conventions (routing, metadata, error boundaries) and delegate to `application/`.

### Trade-offs accepted

- **Model imports infrastructure directly** (services call `apiFetch`) rather than inverting through ports. The http client is a thin, stable gateway; inverting it adds indirection with no current substitution need. `MediaStore` (ADR 0019) already demonstrates the port/adapter form where substitution *is* planned, and keeps it.
- **ViewModels are React hooks**, not framework-agnostic classes. They are the testable seam; going framework-free would require an observable store abstraction V1 does not need.
- **Shared presentational components take a `classes` prop** (the screen's CSS-module object) where screens legitimately differ visually (e.g. `FormField`, `Wordmark`). This preserves the token/CSS-module rules (ADR 0007) and avoids a visual-regression risk during the refactor; consolidating the duplicated CSS itself is deferred.

## Consequences

- Behaviour becomes unit-testable at the viewmodel and service level without rendering.
- Screens shrink to render-only files; duplicated icons/fields/helpers collapse into `application/components` and `utils`.
- The Cypress E2E suites (130 tests) are the regression harness for the refactor — all `data-testid` attributes and user-visible behaviour are preserved verbatim.
- New screens must follow the same shape: spec → viewmodel + service → view.
