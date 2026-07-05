import type { SQLiteDatabase } from 'expo-sqlite';

// A column added to a table after that table's original CREATE TABLE
// shipped. CREATE TABLE IF NOT EXISTS below is a no-op for a device that
// already has the table from before the column existed -- ALTER TABLE is
// the only way an existing local install ever gets it. See this file's
// applyColumnMigrations() and ADR 0026's 2026-07-05 update.
interface ColumnMigration {
  table: string;
  column: string;
  definition: string;
}

const COLUMN_MIGRATIONS: ColumnMigration[] = [
  { table: 'vehicles', column: 'total_spent', definition: 'TEXT' },
  { table: 'vehicles', column: 'last_logged_at', definition: 'TEXT' },
  { table: 'vehicles', column: 'transfer_pending', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'vehicles', column: 'pending_transfer_recipient_email', definition: 'TEXT' },
  { table: 'log_entries', column: 'notes', definition: 'TEXT' },
  { table: 'log_entries', column: 'items_json', definition: "TEXT NOT NULL DEFAULT '[]'" },
  { table: 'log_entries', column: 'detail_fetched', definition: 'INTEGER NOT NULL DEFAULT 0' },
];

// Idempotent: skips any column PRAGMA table_info already reports, so a
// fresh install (whose CREATE TABLE below already has every column) runs
// this as a no-op, and a stale install picks up exactly what it's missing.
// Every entry here is either nullable or has a literal DEFAULT, both of
// which SQLite's ADD COLUMN accepts.
function applyColumnMigrations(db: SQLiteDatabase): void {
  for (const { table, column, definition } of COLUMN_MIGRATIONS) {
    const existingColumns = db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
    const hasColumn = existingColumns.some((c) => c.name === column);
    if (!hasColumn) {
      db.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

// Hand-written DDL, not drizzle-kit codegen — three tables don't warrant a
// migration-file pipeline. CREATE TABLE IF NOT EXISTS runs on every
// openDatabase() call and is idempotent for tables that don't exist yet;
// applyColumnMigrations() (below) is what makes it idempotent for columns
// added to a table that already exists on a given install. See ADR 0026's
// 2026-07-05 update for why both are needed together.
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

    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL
    );
  `);

  applyColumnMigrations(db);
}
