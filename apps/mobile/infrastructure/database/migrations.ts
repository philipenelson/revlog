import type { SQLiteDatabase } from 'expo-sqlite';

// Hand-written DDL, not drizzle-kit codegen — two tables don't warrant a
// migration-file pipeline. Runs once, on every openDatabase() call
// (CREATE TABLE IF NOT EXISTS is idempotent).
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
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS outbox_status_created_at ON outbox (status, created_at);
  `);
}
