import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from './migrations';

// A fake covering only the two SQLiteDatabase methods runMigrations()
// actually calls -- execSync() to run DDL, getAllSync() to answer
// PRAGMA table_info(). tableColumns seeds what each table "already has"
// before runMigrations() runs, so a test can simulate a stale install
// missing a column that a fresh CREATE TABLE would already include.
function fakeDb(tableColumns: Record<string, string[]>) {
  const executedSql: string[] = [];
  const columns = { ...tableColumns };

  const db = {
    execSync: jest.fn((sql: string) => {
      executedSql.push(sql);
      // A real CREATE TABLE IF NOT EXISTS is a no-op once the table
      // already has rows in `columns` -- this fake only needs to track
      // ALTER TABLE's effect, since that's the behaviour under test.
      const alterMatch = sql.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/);
      if (alterMatch) {
        const [, table, column] = alterMatch as unknown as [string, string, string];
        columns[table] = [...(columns[table] ?? []), column];
      }
    }),
    getAllSync: jest.fn((sql: string) => {
      const match = sql.match(/PRAGMA table_info\((\w+)\)/);
      const table = match?.[1] ?? '';
      return (columns[table] ?? []).map((name) => ({ name }));
    }),
  };

  return { db: db as unknown as SQLiteDatabase, executedSql };
}

// Every column any table has once it's fully up to date -- mirrors the
// CREATE TABLE statements in migrations.ts.
const FRESH_VEHICLES_COLUMNS = [
  'id',
  'nickname',
  'make',
  'model',
  'year',
  'mileage',
  'photo_url',
  'log_entry_count',
  'sort_order',
  'total_spent',
  'last_logged_at',
  'transfer_pending',
  'pending_transfer_recipient_email',
];

const FRESH_LOG_ENTRIES_COLUMNS = [
  'id',
  'vehicle_id',
  'type_id',
  'title',
  'date',
  'time',
  'mileage',
  'item_count',
  'media_count',
  'total_cost',
  'notes',
  'items_json',
  'detail_fetched',
];

describe('runMigrations', () => {
  it('adds no columns to a fully up-to-date install (idempotent)', () => {
    const { db, executedSql } = fakeDb({
      vehicles: FRESH_VEHICLES_COLUMNS,
      outbox: ['id', 'type', 'payload', 'created_at', 'status'],
      log_entries: FRESH_LOG_ENTRIES_COLUMNS,
    });

    runMigrations(db);

    expect(executedSql.some((sql) => sql.includes('ALTER TABLE'))).toBe(false);
  });

  // Regression test for the real bug this fixes: a local install created
  // before ADR 0027's 2026-07-04 update added notes/items_json/
  // detail_fetched to log_entries kept failing every sync with
  // "table log_entries has no column named notes", because
  // CREATE TABLE IF NOT EXISTS is a no-op once the table already exists.
  it('adds log_entries columns missing on a stale install that predates them', () => {
    const { db, executedSql } = fakeDb({
      vehicles: FRESH_VEHICLES_COLUMNS,
      outbox: ['id', 'type', 'payload', 'created_at', 'status'],
      log_entries: ['id', 'vehicle_id', 'type_id', 'title', 'date', 'time', 'mileage', 'item_count', 'media_count', 'total_cost'],
    });

    runMigrations(db);

    expect(executedSql).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ALTER TABLE log_entries ADD COLUMN notes TEXT'),
        expect.stringContaining("ALTER TABLE log_entries ADD COLUMN items_json TEXT NOT NULL DEFAULT '[]'"),
        expect.stringContaining('ALTER TABLE log_entries ADD COLUMN detail_fetched INTEGER NOT NULL DEFAULT 0'),
      ]),
    );
  });

  it('adds vehicles columns missing on a stale install that predates the transfer feature', () => {
    const { db, executedSql } = fakeDb({
      vehicles: ['id', 'nickname', 'make', 'model', 'year', 'mileage', 'photo_url', 'log_entry_count', 'sort_order'],
      outbox: ['id', 'type', 'payload', 'created_at', 'status'],
      log_entries: FRESH_LOG_ENTRIES_COLUMNS,
    });

    runMigrations(db);

    expect(executedSql).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ALTER TABLE vehicles ADD COLUMN total_spent TEXT'),
        expect.stringContaining('ALTER TABLE vehicles ADD COLUMN last_logged_at TEXT'),
        expect.stringContaining('ALTER TABLE vehicles ADD COLUMN transfer_pending INTEGER NOT NULL DEFAULT 0'),
        expect.stringContaining('ALTER TABLE vehicles ADD COLUMN pending_transfer_recipient_email TEXT'),
      ]),
    );
  });

  it('always runs the CREATE TABLE IF NOT EXISTS statements before checking columns', () => {
    const { db, executedSql } = fakeDb({});

    runMigrations(db);

    expect(executedSql[0]).toContain('CREATE TABLE IF NOT EXISTS vehicles');
  });
});
