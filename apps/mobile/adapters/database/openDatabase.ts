import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { secureStorage } from '@/adapters/storage/secureStorage';
import { runMigrations } from './migrations';

const DATABASE_NAME = 'revlog.db';

export type DrizzleDb = ReturnType<typeof drizzle>;

// Called exactly once, by DatabaseProvider. expo-sqlite's SQLCipher support
// has no "key" open option (ADR 0026's 2026-07-02 update) — the key is set
// via PRAGMA immediately after opening, before any other statement runs.
export async function openDatabase(): Promise<DrizzleDb> {
  const key = await secureStorage.getOrCreateDbKey();
  const rawDb = SQLite.openDatabaseSync(DATABASE_NAME);
  rawDb.execSync(`PRAGMA key = '${key}';`);
  // Off by default per-connection in SQLite — required for log_entries'
  // ON DELETE CASCADE (ADR 0027's 2026-07-02 update) to actually cascade.
  rawDb.execSync('PRAGMA foreign_keys = ON;');
  runMigrations(rawDb);
  return drizzle(rawDb);
}
