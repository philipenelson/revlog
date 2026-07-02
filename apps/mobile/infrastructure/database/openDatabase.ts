import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { secureStorage } from '@/infrastructure/storage/secureStorage';
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
  runMigrations(rawDb);
  return drizzle(rawDb);
}
