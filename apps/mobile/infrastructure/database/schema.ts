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
  // Vehicle Detail fields — populated by SyncService.pull()'s per-vehicle
  // GET /vehicles/:vehicleId phase, not the GET /vehicles list phase (which
  // can't supply them). See ADR 0027's 2026-07-03 update. Defaulted on
  // insert so phase 1's reconcile() can write a row before phase 2 fills
  // these in, within the same pull().
  totalSpent: text('total_spent'),
  lastLoggedAt: text('last_logged_at'),
  transferPending: integer('transfer_pending', { mode: 'boolean' }).notNull().default(false),
  pendingTransferRecipientEmail: text('pending_transfer_recipient_email'),
});

// Outbox schema per ADR 0027 (id doubles as the idempotency key).
export const outboxTable = sqliteTable('outbox', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
  status: text('status').notNull().default('pending'),
});

// Log Entries — child collection of Vehicles, reconciled as a single flat
// collection across all Vehicles in one pass (ADR 0027's 2026-07-03
// update), not scoped per-vehicle at the Store<T> level.
export const logEntriesTable = sqliteTable('log_entries', {
  id: text('id').primaryKey(),
  vehicleId: text('vehicle_id')
    .notNull()
    .references(() => vehiclesTable.id, { onDelete: 'cascade' }),
  typeId: text('type_id').notNull(),
  title: text('title').notNull(),
  date: text('date').notNull(),
  time: text('time'),
  mileage: integer('mileage'),
  itemCount: integer('item_count').notNull(),
  mediaCount: integer('media_count').notNull(),
  totalCost: text('total_cost'),
});
