# Session: Hexagonal (Ports & Adapters) rearchitecture — API

## Goal

Migrate the API from the 2003-era DDD technical layering (`routes/ → services/ →
repositories/`) to Cockburn's Hexagonal (Ports & Adapters) architecture. First of three
apps; web and mobile follow in their own sessions/ADRs.

## Key Decisions

- **Full hexagon, pragmatic.** `domain/` (models + ports) and `application/` (use-case
  services + app-specific ports) form the framework-free core; `adapters/{http,persistence,
  email,token}` are the outside; `app.ts` is the composition root. **No inbound port
  interfaces** (the service *is* the implementation) and services stay cohesive (not
  exploded into per-action classes) — ADR 0039 §4.
- **Split, don't share.** The "shared" `Domain*` types and `I*Repository` ports in
  `packages/domain` were imported by `apps/api` *only* — a false abstraction (mobile has its
  own SQLite ports; web has none). Moved them into `apps/api/src/domain/`; `packages/domain`
  narrows to the genuine system-wide contract (Zod schemas + `*Input` types + lookup
  constants + Account enums), which web/mobile/api-client actually consume.
- **Naming.** Dropped the `Domain*` prefix on entities and the `I` prefix on ports; adapters
  keep a `Prisma*` implementation prefix. No collisions (Prisma models are reached only via
  `PrismaClient` methods, never name-imported).
- **`lib/` kept** as the low-level transports the adapters wrap (logger, prisma, tokens/jose,
  email/nodemailer, upload/multer). `lib/upload` stayed put because its `UPLOADS_DIR` is
  `__dirname`-relative; moving it would silently break the path.
- **`@maintenance-log/domain` not renamed** (~65 import sites across all apps) — deferred.

## What Was Built

- **ADR 0039** + rewritten `apps/api/CLAUDE.md` + root doc touch-ups (`7c64118`).
- **Domain split**: `apps/api/src/domain/{models,ports}/` (de-prefixed); `packages/domain`
  slimmed; the lone in-API `IInsuranceRepository` joined the other ports (`bcb10c9`).
- **Outbound ports**: `TokenService`/`JwtTokenService` (closes the one DI leak — `AuthService`
  no longer imports `lib/tokens`) and a consolidated `EmailSender`/`NodemailerEmailSender`
  replacing three ad-hoc email shapes (`e39cf2f`).
- **Prisma out of the application layer**: `LogEntryService` no longer takes a `PrismaClient`;
  reference-data checks moved behind a `MetadataRepository` port and the mileage bump /
  existence check onto `VehicleRepository` (`cc166d6`).
- **Physical reorg**: `services/`→`application/services/`, `repositories/`→
  `adapters/persistence/`, `routes/`→`adapters/http/routers/`, `middleware/`→
  `adapters/http/middleware/`, via `git mv` (all 47 files tracked as renames, blame
  preserved), imports recomputed from the move map (`f299283`).

## Verification

- `pnpm --filter @maintenance-log/api test` — **326/326 pass, exit 0** at every step.
- `pnpm --filter @maintenance-log/api type-check` — only **2 pre-existing test-file errors**
  that also exist on `main` (an `auth.service.test` numeric-arg mismatch and a
  `vehicle-report.service.test` fixture missing two fields); **zero new** errors from the
  refactor.
- Web + mobile type-check — **0 domain-related errors** (web shows only pre-existing React-19
  JSX-component noise), confirming the narrowed shared package is intact.
- Booted the API and `GET /health` → `{"status":"ok"}`, exercising the rewired composition
  root.

## Out of Scope / Follow-ups

- Web and mobile hexagonal passes (own ADRs).
- Renaming `@maintenance-log/domain` to a contract-oriented name.
- De-duplicating the API internal models vs. `api-client` wire DTOs (cross-app concern).
- The 2 pre-existing test-file type errors (predate this work; left untouched to keep the
  refactor scoped). The API package has no runnable `eslint` (binary not installed) — a
  pre-existing config gap.
