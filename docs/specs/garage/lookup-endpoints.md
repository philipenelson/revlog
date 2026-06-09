# Lookup Endpoints Spec

**Area:** Garage / Log Entry
**Status:** In progress
**Last updated:** 2026-06-09

---

## Overview

Two read-only endpoints and a shared domain constants file that let the frontend populate type pickers without hardcoding values in UI components.

- `GET /log-entry-types` — returns the ordered list of `LogEntryType` IDs
- `GET /item-categories` — returns the ordered list of `ItemCategory` IDs
- `packages/domain/src/lookup-constants.ts` — `LOG_ENTRY_TYPE` and `ITEM_CATEGORY` TypeScript consts for type-safe references across the codebase

The DB tables (`LogEntryType`, `ItemCategory`) and seed script (`apps/api/prisma/seed.ts`) already exist per [ADR 0018](../../adr/0018-log-entry-data-model.md). This spec covers the route layer and the domain constants.

---

## Use Cases

### UC-LOOKUP-1 — Frontend fetches available log entry types on mount

1. Log entry form mounts → `GET /log-entry-types`
2. API returns ordered list of type IDs
3. Form renders a type picker with one option per ID, labels resolved from frontend constants

### UC-LOOKUP-2 — Frontend fetches item categories on mount

Same pattern as UC-LOOKUP-1 for `GET /item-categories`.

---

## `GET /log-entry-types`

### Request

```
GET /log-entry-types
```

No authentication required — these are static reference values.

### Response — 200 OK

```json
{
  "logEntryTypes": [
    "MAINTENANCE",
    "REPAIR",
    "INSPECTION",
    "MODIFICATION",
    "INCIDENT",
    "EVENT",
    "OTHER"
  ]
}
```

Order is stable and matches the seed order. No 4xx/5xx responses — this endpoint cannot fail.

---

## `GET /item-categories`

### Request

```
GET /item-categories
```

### Response — 200 OK

```json
{
  "itemCategories": ["PART", "LABOR", "FEE", "OTHER"]
}
```

---

## Domain constants (`packages/domain/src/lookup-constants.ts`)

```typescript
export const LOG_ENTRY_TYPE = {
  MAINTENANCE:  'MAINTENANCE',
  REPAIR:       'REPAIR',
  INSPECTION:   'INSPECTION',
  MODIFICATION: 'MODIFICATION',
  INCIDENT:     'INCIDENT',
  EVENT:        'EVENT',
  OTHER:        'OTHER',
} as const;
export type LogEntryTypeId = typeof LOG_ENTRY_TYPE[keyof typeof LOG_ENTRY_TYPE];

export const ITEM_CATEGORY = {
  PART:  'PART',
  LABOR: 'LABOR',
  FEE:   'FEE',
  OTHER: 'OTHER',
} as const;
export type ItemCategoryId = typeof ITEM_CATEGORY[keyof typeof ITEM_CATEGORY];
```

These consts are exported from `@maintenance-log/domain`. Any app that needs a type-safe reference to an entry type or category imports from here rather than using raw strings.

---

## Route layer

Both handlers live in `apps/api/src/routes/lookup.ts` and are registered in `app.ts`. They currently exist as inline handlers in `app.ts`; this spec formalises them as a dedicated router.

The handlers return static arrays — no DB read, no service, no auth. Per ADR 0018, the DB tables hold only stable IDs; the application treats them as constants.

---

## Acceptance Criteria

- [ ] `GET /log-entry-types` returns 200 with the 7 type IDs in seed order, no auth required
- [ ] `GET /item-categories` returns 200 with the 4 category IDs in seed order, no auth required
- [ ] Both handlers live in `apps/api/src/routes/lookup.ts`, not inline in `app.ts`
- [ ] `LOG_ENTRY_TYPE` and `ITEM_CATEGORY` consts exported from `@maintenance-log/domain`
- [ ] `LogEntryTypeId` and `ItemCategoryId` types exported alongside consts
- [ ] Unit tests: both endpoints return 200 with correct payloads
- [ ] `docs/milestones/v1.md` items marked `[x]`

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Static response (no DB read) | Hardcoded arrays matching seed data | IDs never change at runtime; a DB read adds latency and a failure mode for data that is effectively a compile-time constant |
| No auth | Public endpoints | Type pickers are needed before a user has signed in (e.g. onboarding) and the data is non-sensitive |
| Single `lookup.ts` router | Both endpoints in one file | They are logically paired and trivially small; no service layer needed |
