# Hexagonal (Ports & Adapters) architecture for the API

## Context

The API's layering was shaped by 2003-era Evans DDD and expressed as three technical
layers — `routes/ → services/ → repositories/` (see `apps/api/CLAUDE.md`). Since then the
industry reference point for this style has shifted to Alistair Cockburn's **Hexagonal
(Ports & Adapters)** architecture, which names the *direction of dependencies* (driving vs.
driven, inside vs. outside) rather than the *technical role* of each layer.

An audit found the API is already ~80% hexagonal in substance, just not in name:

- **Constructor DI** is established (ADR 0014). Services receive every I/O collaborator
  through the constructor; `src/app.ts` is a real composition root.
- **Driven ports already exist**: `I*Repository` interfaces were declared in the
  framework-free `packages/domain` package, with `PrismaXxxRepository` adapters in the API.
  The domain package never imports Prisma.
- **A named Port/Adapter precedent** exists (`MediaStore`, ADR 0019).

Three things kept it from being cleanly hexagonal:

1. **Folder names describe technical layers, not the hexagon.** `routes/`, `services/`,
   `repositories/` obscure which side of the boundary a file sits on.
2. **Two outbound dependencies were not formalized as ports.** Email was injected as three
   ad-hoc inline object shapes; JWT signing was imported directly from `lib/tokens` by
   `auth.service` (the one DI leak). `LogEntryService` took a raw `PrismaClient` for
   reference-data lookups — persistence leaking into the application core.
3. **The "shared" domain was a false abstraction.** `packages/domain`'s `Domain*` entity
   types and `I*Repository` ports were imported by **`apps/api` only**. The mobile app has
   its *own* repository ports over SQLite; the web app has none (it consumes `api-client`
   DTOs). Web, mobile, and `api-client` import from `@maintenance-log/domain` *only* Zod
   schemas, their inferred `*Input` types, and lookup constants. Housing the API's internal
   models and Prisma-facing ports in a "shared" package implied a sharing that never existed.

This ADR covers the **API only**. The web and mobile apps get their own hexagonal passes
under separate ADRs. The web MVVM decision (ADR 0020) and the mobile layered decision
(ADR 0023) are unchanged by this ADR.

## Decision

Reorganize `apps/api/src/` around the hexagon: a framework-free core (`domain/` +
`application/`) surrounded by adapters, with all dependencies pointing inward.

### 1. The split — contracts stay shared, the domain goes private

`packages/domain` narrows to the **system-wide contract** that all apps genuinely agree on:
Zod schemas, their inferred `*Input` types, and lookup constants/enums (`AccountStatus`,
`AccountType`, `LogEntryTypeId`, `ItemCategoryId`, `ITEM_CATEGORY`).

The API's **rich entity models and repository ports move into the API** at
`apps/api/src/domain/`. These were never shared; making them private tells the truth and
keeps the server's internal model from leaking to clients (frontends depend on the API's
*wire contract* via `api-client`, not on the server's internal representation).

This is a divergence, not a duplication bug: a server repository port (Prisma) and an
offline client repository port (SQLite + outbox) are *inherently different ports for
different adapters* and cannot be one interface. The `@maintenance-log/domain` package is
**not renamed** (it is imported at ~65 sites across all apps); only its role narrows.

### 2. Layout

```
apps/api/src/
  domain/                 Framework-free core — no Express, no Prisma
    models/               Entity types + server repo-input types
    ports/                Repository (driven) port interfaces
  application/            Use-case orchestration
    services/             The *Service classes (business logic)
    ports/                App-specific outbound ports (EmailSender, TokenService)
  adapters/               The "outside"
    http/                 Driving adapters
      routers/            createXxxRouter factories
      middleware/         authenticate, error middleware + AppError
    persistence/          PrismaXxxRepository (driven)
    email/                NodemailerEmailSender (driven)
    token/                JwtTokenService (driven)
  app.ts                  Composition root (unchanged role)
  index.ts                Server bootstrap
  lib/                    Low-level transports the adapters wrap + cross-cutting
                          singletons: logger, prisma, tokens (jose), email
                          (nodemailer), upload (multer)
```

Dependency direction is one-way and inward: `adapters → application → domain`. `domain`
imports nothing but the shared contract package; `application` imports `domain` + the
shared package; `adapters` implement ports and are the only code that touches Express,
Prisma, Nodemailer, or JWT libraries.

### 3. Naming

Drop the `Domain*` prefix on entity types (`DomainVehicle → Vehicle`) and the `I` prefix on
ports (`IVehicleRepository → VehicleRepository`). Adapters keep an implementation prefix
naming their technology (`PrismaVehicleRepository`, `NodemailerEmailSender`,
`JwtTokenService`). No collisions result — Prisma model types are only reached through
`PrismaClient` methods, never name-imported. Files are named for their type/class in
PascalCase, matching the mobile app's convention.

### 4. No inbound (driving) port interfaces

We deliberately do **not** introduce interfaces for the use-case services (no
`RegisterUserUseCase` interface in front of `AuthService`). In a TypeScript/Node backend the
HTTP adapter never swaps the service implementation — the service *is* the implementation.
Adding inbound ports here is boilerplate without a seam. Services also stay **cohesive**
(`VehicleService` with its methods) rather than being exploded into one class per action.

### 5. Three closed leaks

- **Token port.** `TokenService` (application/ports) implemented by `JwtTokenService`
  (adapters/token), wrapping `lib/tokens`. Injected into `AuthService` and used by the HTTP
  `authenticate` middleware. No service imports `lib/tokens` directly anymore.
- **Email port.** One `EmailSender` port (application/ports) replaces the three ad-hoc
  injected shapes, implemented by `NodemailerEmailSender` (adapters/email) wrapping
  `lib/email`.
- **Prisma out of the application layer.** `LogEntryService` no longer takes a
  `PrismaClient`. Reference-data existence checks move behind a `MetadataRepository` port
  (`logEntryTypeExists`, `itemCategoryExists`); the mileage bump moves onto
  `VehicleRepository` (`existsById`, `bumpMileageIfLower`).

## Why not a DI container / inbound ports / a renamed package

- **DI container** — still unwarranted at this scale (ADR 0014's reasoning holds). Manual
  wiring in `app.ts` stays readable.
- **Inbound ports** — see §4; a seam nobody exercises is cost without benefit.
- **Renaming `@maintenance-log/domain`** — ~65 import sites across web/mobile/api-client
  would churn for a cosmetic gain and break the API-focused scope. Deferred.

## Trade-offs

- One large, mostly-mechanical reorg touching nearly every API file. Mitigated by sequenced
  commits (each green), doing type renames in place before physically relocating files
  (preserving `git blame`), and `git mv` for the moves.
- Some entity shapes now exist in two forms — the API's internal model and `api-client`'s
  wire DTO. This is intentional layering (the client depends on the contract, not the
  server's model), not drift. De-duplicating the two representations is a separate concern.
- Files that are *split* (one `packages/domain` entity file → `models/` + `ports/`) cannot
  keep linear history — intrinsic to splitting.

## Status

accepted

## Consequences

- New API features follow the hexagon: model + port in `domain/`, orchestration in
  `application/services/`, Express/Prisma/etc. only in `adapters/`.
- `packages/domain` is the shared **contract** package (schemas + input types + constants).
  Nothing framework-specific or server-internal belongs there.
- ADR 0014 (constructor DI) is the mechanism this structure formalizes — unchanged, now
  with every outbound dependency behind a named port.
- ADR 0003 (package boundary guardrails) still holds; the domain package's surface shrinks
  but its "no app imports it upward" rule is unchanged.

## V2+ items

- Web and mobile hexagonal passes (own ADRs).
- Optional rename of `@maintenance-log/domain` → a contract-oriented name.
- Consolidating the API internal model vs. `api-client` wire DTO where a single shared
  contract type would serve both.

## Update (2026-07-10) — package renamed to `@maintenance-log/contracts`

The rename deferred above (and in ADR 0040) is now done: the shared package was renamed
`@maintenance-log/domain` → **`@maintenance-log/contracts`**, reflecting its narrowed role
(Zod schemas, inferred `*Input` types, lookup constants/enums). Only the **package name**
changed; the **directory stays `packages/domain`** — keeping the ~30 historical
`packages/domain` path references valid and avoiding any workspace-glob/tsconfig/Docker path
surgery (the workspace resolves by `package.json` name via pnpm symlink, so a name≠directory
is inert). All ~51 code import sites plus the five `package.json` declarations were updated;
active docs (CLAUDE.md files, current specs) were repointed, while historical session notes
and the original body of this ADR retain the former name as a snapshot. The prose above (which
records the rename as *deferred*) is preserved intact per our amend-don't-rewrite convention.
