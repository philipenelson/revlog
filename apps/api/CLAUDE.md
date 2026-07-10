# API — Architecture Rules

The API uses **Hexagonal (Ports & Adapters)** architecture (ADR 0039). Dependencies point
one way and inward:

```
adapters/ → application/ → domain/
```

`domain/` and `application/` are the framework-free core. `adapters/` is the only place that
touches Express, Prisma, Nodemailer, or JWT libraries. Nothing in the core imports a
framework.

## Layers

### `domain/` — the core (`src/domain/`)

```
domain/
  models/    ← entity types (Vehicle, VehicleDetail, User, Account, LogEntry, …)
             ← + server repo-input types (CreateVehicleData, UpdateVehicleData, …)
  ports/     ← driven port interfaces (VehicleRepository, UserRepository,
               MetadataRepository, …)
```

Framework-free. Imports nothing but the shared contract package
(`@maintenance-log/domain`: Zod schemas, `*Input` types, lookup constants). No Prisma, no
Express. Entity types have **no** `Domain` prefix; ports have **no** `I` prefix.

### `application/` — use cases (`src/application/`)

```
application/
  services/  ← the *Service classes: business logic, orchestration
  ports/     ← app-specific outbound ports (EmailSender, TokenService)
```

Services own the business logic:
- Orchestrate repository (driven-port) calls
- Make domain decisions ("is this email taken?", "has the token expired?")
- Throw `AppError` for known failure conditions

Services receive **every** I/O collaborator through the constructor as a **port interface** —
never a concrete adapter, never a framework import. No `req`/`res`/`next`. No Prisma. No
`lib/tokens` / `lib/email`. Services stay cohesive (one `VehicleService` with methods); we do
**not** split them into one class per action, and we do **not** put interfaces in front of
them (no inbound ports — the service is the implementation). See ADR 0039 §4.

### `adapters/` — the outside (`src/adapters/`)

```
adapters/
  http/
    routers/     ← createXxxRouter(service) factories: parse/validate, call one
                   service method, map result → HTTP, pass errors to next(err)
    middleware/  ← authenticate (uses TokenService), errorMiddleware + AppError
    upload/      ← multer vehiclePhotoUpload (HTTP-only concern)
  persistence/   ← PrismaXxxRepository: implement a domain/ports interface,
                   accept a db client in the constructor, return domain models
                   (never raw Prisma rows), no business logic
  email/         ← NodemailerEmailSender: implements EmailSender
  token/         ← JwtTokenService: implements TokenService
```

Driving adapters (`http/`) call into the application. Driven adapters (`persistence/`,
`email/`, `token/`) implement ports the core defines. Adapters are the only code importing
Express, Prisma, Nodemailer, or `jsonwebtoken`.

---

## Ports live in the layer that needs them

- **Repository (driven) ports** → `domain/ports/`. Every persisted entity defines its port
  here; the API implements it with Prisma in `adapters/persistence/`. The domain never knows
  about Prisma.
- **App-specific outbound ports** (`EmailSender`, `TokenService`) → `application/ports/`,
  implemented in `adapters/email/` and `adapters/token/`.

There is no standalone top-level `ports/` folder.

```
domain/ports/VehicleRepository.ts        → adapters/persistence/PrismaVehicleRepository.ts
application/ports/EmailSender.ts          → adapters/email/NodemailerEmailSender.ts
application/ports/TokenService.ts         → adapters/token/JwtTokenService.ts
```

## The shared contract package

`@maintenance-log/domain` (`packages/domain`) holds only what web, mobile, and the API all
agree on: Zod schemas, their inferred `*Input` types, and lookup constants. It does **not**
hold the API's entity models or repository ports — those are private to the API
(`src/domain/`). Do not add server-internal or framework-specific types to the package.

---

## Dependency injection (non-negotiable)

Services receive all I/O collaborators through the constructor as **port interfaces**.
The **composition root is `src/app.ts`** — the only place that `new`s concrete adapters
(`PrismaXxxRepository`, `NodemailerEmailSender`, `JwtTokenService`) and wires them into
services and routers. Routers are factories (`createXxxRouter(service)`) — never pre-wired
module-level values.

**Acceptable exceptions**: `logger` is a global import anywhere (no state, not worth
injecting); the Prisma client is instantiated once in `app.ts`.

See ADR 0014 (the DI mechanism) and ADR 0039 (the hexagon it formalizes).

---

## Token and session management

- **Signing/generating** tokens goes through the `TokenService` port (adapter:
  `JwtTokenService`), injected into `AuthService`. Services never import `lib/tokens`.
- **Validating** tokens (authentication) happens in `adapters/http/middleware/authenticate`,
  which also uses `TokenService`.
- **Cookie** setting happens in routers, using values returned from services.

---

## Error handling

All errors flow to the global error middleware (`adapters/http/middleware`):
- Routers pass errors via `next(err)` — never swallow or format them inline
- Services throw `AppError` for known conditions
- Unexpected errors surface as 500 — raw messages hidden in production

---

## Observability — V2 roadmap

V1 uses Pino structured logging. In V2, OpenTelemetry layers on top (`@opentelemetry/sdk-node`
with Express + Prisma instrumentation; `trace_id`/`span_id` in every log line; OTLP export).
The `logger` interface (`src/lib/logger.ts`) stays the same; only the transport changes. See
`docs/milestones/v2.md` — Observability.

---

## Unit testing

Test files are co-located with the source (`src/**/*.test.ts`) and run with Vitest.

### What to test

| Layer | Test approach | What's verified |
|---|---|---|
| HTTP routers | `supertest` + mock service injected | status codes, correct service method + args, cookie/header attributes, validation rejects before the service is reached |
| Application services | Fake port implementations injected via constructor | business logic: guard clauses (duplicate → 409, expired token → 400), correct data passed to ports, email sent with correct args |
| Pure utilities | Direct calls | e.g. `generateRefreshToken`: length, SHA-256 hash matches, unique per call |

### What NOT to test

- **Persistence adapters** (`PrismaXxxRepository`) — thin Prisma translators with no logic;
  cover at integration level (real DB) when needed
- **Library behaviour** — never assert bcrypt hashes, Prisma writes rows, or JWT signs a
  valid token; test *your* code that calls these
