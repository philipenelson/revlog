# API — Architecture Rules

## Layered architecture (non-negotiable)

Every feature is split into exactly three layers. Each layer has one job.

### Routes (`src/routes/`)

Handle HTTP only:
- Parse and validate the request body/query using schemas from `@maintenance-log/domain`
- Call one service method
- Map the result to an HTTP response and status code
- Pass errors to `next(err)` — never handle them inline

No business logic. No direct database access. No token signing. No `crypto`.

### Services (`src/services/`)

Own the business logic:
- Orchestrate repository calls (including transactions)
- Make domain decisions ("is this email taken?", "has the token expired?")
- Call other services or utilities (email, tokens)
- Throw `AppError` for known failure conditions

No `req`, `res`, or `next`. No direct Prisma imports — use repositories.

### Repositories (`src/repositories/`)

Own all database access:
- Implement the repository interface from `packages/domain/<entity>/`
- Accept a db client (Prisma client or transaction client) in the constructor
- Return domain types (`Domain*`), never raw Prisma models
- No business logic — no decisions, no conditionals beyond query filters

---

## Repository interfaces in `packages/domain`

Every entity that needs persistence defines its repository interface in
`packages/domain/src/<entity>/index.ts`. The API implements these with Prisma.

```
packages/domain/src/user/index.ts   → IUserRepository, DomainUser
packages/domain/src/account/index.ts → IAccountRepository, DomainAccount

apps/api/src/repositories/user.repository.ts    → PrismaUserRepository
apps/api/src/repositories/account.repository.ts → PrismaAccountRepository
```

The domain layer never knows about Prisma. The repository implementation in the
API translates between Prisma models and domain types.

---

## Token and session management

- **Signing** tokens (access + refresh) happens in services, not in routes.
- **Validating** tokens (authentication) happens in middleware (`src/middleware/auth.ts`).
- **Cookie** setting happens in routes, using values returned from services.
- Routes never call `signAccessToken`, `verifyAccessToken`, or touch cookies directly.

---

## Error handling

All errors flow to the global error middleware (`src/middleware/error.ts`):
- Routes pass errors via `next(err)` — never swallow or format them inline
- Services throw `AppError` for known conditions (wrong credentials, token expired, etc.)
- Unexpected errors surface as 500 — raw messages are hidden in production

---

## Dependency injection (non-negotiable)

Services receive **all I/O-touching dependencies through the constructor** — repositories, email service, and any other collaborator that performs I/O. Services never import or instantiate concrete infrastructure directly.

The **composition root is `src/app.ts`** — the only place that `new`s concrete implementations and wires them into services and routers.

Routes are also factories (`createXxxRouter(service)`) — never exported as pre-wired module-level values.

**Acceptable exceptions**: the `logger` is a global import in any file — it has no state and is not worth injecting.

See ADR 0014 for the rationale and the explicit comparison to global singleton patterns.

---

## Unit testing

Test files are co-located with the source (`src/**/*.test.ts`) and run with Vitest.

### What to test

| Layer | Test approach | What's verified |
|---|---|---|
| Routes | `supertest` + mock service injected | HTTP status codes, correct service method called with correct args, cookie/header attributes set, validation rejects before service is reached |
| Services | Fake repo implementations injected via constructor | Business logic: guard clauses (duplicate → 409, expired token → 400), correct data passed to repos, email sent with correct args |
| Pure utilities | Direct function calls | `generateRefreshToken`: correct length, hash matches SHA-256 of raw, unique per call |

### What NOT to test

- **Repositories** — thin Prisma translators with no logic; test at integration level (real DB) when needed
- **Library behaviour** — never assert that bcrypt hashes correctly, Prisma creates rows, or JWT signing produces a valid token; test your code that calls these
