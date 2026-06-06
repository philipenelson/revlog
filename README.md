# Revlog

Motorcycle maintenance tracking for riders who care about their machines. Log service history, track parts, and keep a full record of everything done to every bike — in one place.

V1 is personal accounts only: one rider, one garage, unlimited vehicles and log entries.

---

## Prerequisites

- **Node.js** 22+
- **pnpm** 11+
- **Docker** (for Postgres and Mailpit)

---

## First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Install the pre-commit hook (hex color guard + lint)
pnpm hooks

# 3. Copy the API environment file and fill in values
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — at minimum set JWT_SECRET to a random string

# 4. Start Postgres and Mailpit
pnpm db

# 5. Run database migrations
pnpm --filter @maintenance-log/api db:migrate
```

---

## Dev workflow

```bash
pnpm dev        # start API (port 3001) and web (port 3000) in parallel
```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| API | http://localhost:3001 |
| API health | http://localhost:3001/health |
| Mailpit (email UI) | http://localhost:8025 |

All outgoing emails in development are captured by Mailpit — nothing is sent to real addresses.

---

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Start all packages in watch mode (Turbo) |
| `pnpm build` | Production build of all packages |
| `pnpm lint` | ESLint across all packages |
| `pnpm type-check` | TypeScript type-check across all packages |
| `pnpm test` | Run all test suites (Vitest unit tests + Cypress E2E) |
| `pnpm clean` | Delete all build artifacts and `node_modules` |
| `pnpm hooks` | Install the pre-commit hook (run once after cloning) |
| `pnpm db` | Start Postgres and Mailpit via Docker Compose |
| `pnpm db:stop` | Stop Docker Compose services |
| `pnpm db:studio` | Open Prisma Studio (visual DB browser) |
| `pnpm smoke:auth` | End-to-end smoke test: register → verify email → confirm single-use |

---

## Testing

```bash
# API unit tests (Vitest — no DB required)
pnpm --filter @maintenance-log/api test

# Watch mode
pnpm --filter @maintenance-log/api test:watch

# E2E tests (Cypress — requires dev server running)
pnpm test

# End-to-end smoke test (requires pnpm dev + pnpm db)
pnpm smoke:auth
```

---

## Database

```bash
# Run pending migrations (also generates the Prisma client)
pnpm --filter @maintenance-log/api db:migrate

# Open the Prisma Studio GUI
pnpm db:studio

# Deploy migrations in production (no interactive prompt)
pnpm --filter @maintenance-log/api db:migrate:prod
```

Prisma schema: `apps/api/prisma/schema.prisma`  
Migrations: `apps/api/prisma/migrations/`

---

## Environment variables

All environment configuration lives in `apps/api/.env` (gitignored). The example file documents every variable:

```
apps/api/.env.example
```

Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Secret for signing access tokens — **change in production** |
| `JWT_EXPIRES_IN` | Access token TTL (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (default: `7d`) |
| `SMTP_HOST` / `SMTP_PORT` | SMTP server — `localhost:1025` for Mailpit in dev |
| `APP_URL` | Web app origin — used in verification email links |
| `LOG_LEVEL` | Pino log level: `error`, `warn`, `info`, `debug` (default: `info`) |

---

## Project structure

```
apps/
  api/          Express API — layered arch (Routes → Services → Repositories)
  web/          Next.js web app — App Router
  mobile/       React Native (Expo) — V2
packages/
  domain/       Shared Zod schemas and repository interfaces (no framework deps)
  ui/
    tokens/     Design token source of truth (colours, spacing, typography)
docs/
  adr/          Architecture Decision Records (0001–0014)
  specs/        Feature specs with use cases and acceptance criteria
  milestones/   V1 and V2 scope and progress tracking
scripts/
  pre-commit    Git hook: blocks raw hex colors outside the token package
  smoke-auth.sh End-to-end auth smoke test
```

---

## Documentation

| File | Purpose |
|---|---|
| `CLAUDE.md` | Development rules — style, testing, observability, workflow |
| `CONTEXT.md` | Domain language glossary — canonical terms for the problem domain |
| `docs/adr/` | Architecture Decision Records — every significant technical choice |
| `docs/specs/` | Feature specs — use cases, acceptance criteria, API contracts |
| `docs/milestones/` | V1 and V2 scope and progress |
| `apps/api/CLAUDE.md` | API-specific rules — layered arch, DI, testing |
| `apps/web/CLAUDE.md` | Web-specific rules — style, logging, error boundaries |
