# Revlog

Motorcycle maintenance tracking for riders who care about their machines. Log service history, track parts and costs, and keep a full record of everything done to every bike — in one place.

V1 is personal accounts only: one rider, one garage, unlimited vehicles and log entries.

![Your garage](docs/screenshots/garage.png)

---

## Screens

<table>
<tr>
<td width="50%">

**Onboarding**
First-run setup gets a rider from zero to a saved vehicle in one short flow — no fields beyond what's needed to create the garage.

![Onboarding](docs/screenshots/onboarding.png)

</td>
<td width="50%">

**Add a vehicle**
A live preview mirrors the exact card that will land in the garage grid, so there's no guessing what "Save" produces.

![Add a vehicle](docs/screenshots/add-vehicle.png)

</td>
</tr>
<tr>
<td width="50%">

**Vehicle detail**
Odometer, log count, spend, and insurance status at a glance, with the full service history below.

![Vehicle detail](docs/screenshots/vehicle-detail.png)

</td>
<td width="50%">

**Log entry**
Itemized parts and labor with running totals — the record a mechanic (or a future buyer) would actually want to see.

![Log entry](docs/screenshots/log-entry.png)

</td>
</tr>
</table>

## Design system

The interface follows a single documented design language — **"Precision Dark"**: a dark navy base, one electric-teal accent, and geometric type (`Outfit` for display, `DM Sans` for body, `Geist Mono` for numbers) inspired by digital instrument clusters. A few deliberate choices worth pointing out:

- **A recurring visual language, not a one-off skin.** The tachometer-arc logo extends into a gauge-tick step indicator for multi-step flows and a status orb for async states (seen above on email verification) — the same motif reused with intent, not different widgets bolted together.
- **Empty and stale states are designed, not defaulted.** A vehicle with no logged history reads "No entries yet" in a muted tone rather than a bare `0`, so the UI never implies something is wrong.
- **Restraint on data that isn't ready.** V1 deliberately shows no maintenance-due indicators on vehicle cards — that requires scheduling logic that doesn't exist yet, and a half-built "service due" signal would be worse than none. Purely descriptive data only, until the feature backing it is real.
- **Design tokens are enforced, not just documented.** Every color, spacing, and radius value is required to come from a single token package (`packages/ui/tokens`); a pre-commit hook scans staged files for raw hex codes and blocks the commit if it finds one. See [ADR 0007](docs/adr/0007-style-architecture-guardrails.md).

## How this was built

This project is built in close collaboration with [Claude Code](https://claude.com/claude-code). Every architecture decision goes through an [ADR](docs/adr/) before implementation; every feature gets a [spec](docs/specs/) with use cases and acceptance criteria before code is written. The goal isn't to hide AI involvement — it's to show a disciplined, reviewable process for directing it: documentation before code, one logical change per commit, and automated guardrails (lint rules, pre-commit hooks, unit + E2E tests) that hold regardless of who — or what — wrote the diff.

## Engineering

- **Hexagonal (ports & adapters) architecture** on both the API and the web app — see [ADR 0039](docs/adr/0039-hexagonal-architecture-api.md) (API) and [ADR 0040](docs/adr/0040-hexagonal-architecture-web.md) (web). Business logic never depends on a framework, transport, or database detail.
- **Shared contracts across web and mobile** — Zod validation schemas and API-client service functions live in shared packages (`packages/domain`, `packages/api-client`) so both apps validate and call the API identically.
- **Pure functional core / hook shell** for view logic ([ADR 0043](docs/adr/0043-viewmodel-pure-core-hook-shell-testing.md)) — business rules are stateless functions unit-tested directly; the React hook layer is a thin binding tested separately.
- **Structured logging, never `console.*`** — every I/O path logs through a shared Pino-based logger with proper levels; enforced by convention and code review, not just habit.
- **Tested at two levels** — Vitest unit tests for every API service/route and web viewmodel, Cypress E2E tests for every UI change's happy path and error states.

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
  adr/          Architecture Decision Records
  specs/        Feature specs with use cases and acceptance criteria
  milestones/   V1 and V2 scope and progress tracking
  designs/      Static HTML design previews used to build each screen
  screenshots/  Screenshots used in this README
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
