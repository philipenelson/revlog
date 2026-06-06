# Prisma as the ORM for the API

Raw SQL clients (`pg`, `postgres.js`) keep full control but require hand-written queries and manual type mapping — high boilerplate, high surface area for mistakes. Drizzle is a strong alternative: SQL-first, fully type-safe, minimal runtime. Prisma was chosen instead because its schema language, generated client, and migration CLI produce a clear, interview-friendly pattern with less ceremony than raw SQL and better legibility than Drizzle's query builder for a solo developer reading and explaining code cold.

Prisma lives in `apps/api` and is not extracted to a shared package. No other consumer (web, mobile) touches the database directly in V1. Extracting early would be premature optimisation; if a second DB consumer appears, extracting to `packages/db` is a straightforward refactor.

The migration CLI (`prisma migrate dev`) is the source of truth for schema changes. Schema file changes without a corresponding migration file are not valid.

## Status

accepted

## Trade-offs

- Prisma Client must be (re)generated after any schema change (`prisma generate`). This is a manual step; forgetting it produces type errors. The `db:generate` script makes it explicit.
- Prisma's query engine is a native binary; build times and Docker image size are slightly larger than a pure-JS alternative.
- Prisma's type-safety is client-side only — raw SQL escapes it. Avoid `$queryRaw` except for queries the client genuinely cannot express.

## V2 consideration

If a second service needs DB access, extract schema and client to `packages/db`. Evaluate whether Drizzle's lighter runtime is preferable at that point.
