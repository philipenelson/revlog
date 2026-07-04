import type { SQLiteDatabase } from 'expo-sqlite';

// Hand-written DDL, not drizzle-kit codegen — three tables don't warrant a
// migration-file pipeline. Runs once, on every openDatabase() call
// (CREATE TABLE IF NOT EXISTS is idempotent). No ALTER TABLE for the
// vehicles columns added alongside log_entries: pre-launch, dev-only data,
// consistent with this file's existing no-pipeline stance — a stale dev
// install just needs its local DB cleared.
export function runMigrations(db: SQLiteDatabase): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY NOT NULL,
      nickname TEXT,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      mileage INTEGER NOT NULL,
      photo_url TEXT,
      log_entry_count INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      total_spent TEXT,
      last_logged_at TEXT,
      transfer_pending INTEGER NOT NULL DEFAULT 0,
      pending_transfer_recipient_email TEXT
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS outbox_status_created_at ON outbox (status, created_at);

    CREATE TABLE IF NOT EXISTS log_entries (
      id TEXT PRIMARY KEY NOT NULL,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      type_id TEXT NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      mileage INTEGER,
      item_count INTEGER NOT NULL,
      media_count INTEGER NOT NULL,
      total_cost TEXT,
      notes TEXT,
      items_json TEXT NOT NULL DEFAULT '[]',
      detail_fetched INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS log_entries_vehicle_id ON log_entries (vehicle_id);
  `);
}
