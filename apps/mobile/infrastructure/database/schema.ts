import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Column names are snake_case on disk; property names match the domain
// types (VehicleSummary, OutboxEntry) so Store<T> can address them by key.
export const vehiclesTable = sqliteTable('vehicles', {
  id: text('id').primaryKey(),
  nickname: text('nickname'),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  mileage: integer('mileage').notNull(),
  photoUrl: text('photo_url'),
  logEntryCount: integer('log_entry_count').notNull(),
  // Local-only column: preserves GET /vehicles' response order (the API's
  // "most recently logged" ordering — see garage-list-api.md) across a
  // SELECT, which SQL does not otherwise guarantee without an ORDER BY.
  sortOrder: integer('sort_order').notNull(),
});

// Outbox schema per ADR 0027 (id doubles as the idempotency key).
export const outboxTable = sqliteTable('outbox', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
  status: text('status').notNull().default('pending'),
});
