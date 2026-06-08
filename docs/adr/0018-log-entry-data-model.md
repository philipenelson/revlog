# Log entry types and item categories stored as DB lookup tables, not Prisma enums

## Context

`LogEntry` needs a `type` field (Maintenance, Repair, Inspection, etc.) and `LogItem` needs a `category` field (Part, Labor, Fee, Other). The two obvious options were:

**Option A — Prisma enum:**
```prisma
enum LogEntryType {
  MAINTENANCE
  REPAIR
  INSPECTION
  MODIFICATION
  INCIDENT
  EVENT
  OTHER
}

model LogEntry {
  type LogEntryType
}
```

**Option B — Separate lookup table (FK string):**
```prisma
model LogEntryType {
  id      String     @id
  entries LogEntry[] // back-relation — do not include in queries
}

model LogEntry {
  typeId String
  type   LogEntryType @relation(fields: [typeId], references: [id])
}
```

The same choice applies to `ItemCategory` and `LogItem.categoryId`.

## Decision

Use separate lookup tables (`LogEntryType`, `ItemCategory`) with stable string IDs as primary keys. `LogEntry.typeId` and `LogItem.categoryId` are FK string columns. Both tables are seeded via `prisma/seed.ts`.

Seed values:
- `LogEntryType`: `MAINTENANCE`, `REPAIR`, `INSPECTION`, `MODIFICATION`, `INCIDENT`, `EVENT`, `OTHER`
- `ItemCategory`: `PART`, `LABOR`, `FEE`, `OTHER`

The display label, icon mapping, and i18n key for each type live in TypeScript frontend constants — not in the database. The database stores only the stable ID. The frontend maps IDs to whatever presentation it needs.

TypeScript keeps a const for type-safe code references:
```ts
// packages/domain/src/logEntryTypes.ts
export const LOG_ENTRY_TYPE = {
  MAINTENANCE: 'MAINTENANCE',
  REPAIR:      'REPAIR',
  // …
} as const;
```

The back-relation (`entries LogEntry[]` on `LogEntryType`, `items LogItem[]` on `ItemCategory`) is required by Prisma's schema syntax for bidirectional FK declarations. These back-relations must never be `include`d in queries — they exist only to satisfy the Prisma schema parser and are commented accordingly in `schema.prisma`.

## Why not Prisma enums?

Prisma enums are the simpler choice but have two drawbacks relevant to this project:

1. **Analytics.** With a DB-stored lookup table, `GROUP BY type_id` is straightforward and immediately queryable. With a Prisma enum, the enum values are stored as strings in the column, so grouping works fine — but adding a new type requires a Prisma migration (`ALTER TYPE`), which is a non-trivial operation on Postgres once data exists.

2. **Extensibility without a migration.** A new type can be seeded (`INSERT INTO log_entry_types VALUES ('DETAILING')`) without touching the Prisma schema or cutting a release. The frontend maps the new ID to a label and icon using a shared constants file.

The display label and tooltip description are intentionally NOT stored in the database — they are a UI/i18n concern, not a data concern. Storing them in the DB would require keeping two sources of truth in sync (DB and frontend constants) with no benefit.

## Trade-offs

- **One FK join** added to every Log Entry and Log Item fetch. At the scale of V1 (personal garage, dozens to low hundreds of entries), this is negligible.
- **Seed required.** The application will fail at runtime if the lookup tables are empty. `prisma/seed.ts` must insert both tables' rows before the app is usable. The seed is idempotent (`upsert` semantics).
- **TypeScript const must stay in sync with seed data.** Adding a new type means updating both `prisma/seed.ts` and the TS const. This is minor and is caught immediately if a new ID is used in application logic before being seeded.
- **Back-relation performance risk.** If a developer accidentally adds `include: { entries: true }` to a `LogEntryType` query, it would load every Log Entry in the table. Schema comments document this risk; code review is the enforcement mechanism.
