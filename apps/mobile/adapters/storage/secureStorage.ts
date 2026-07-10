import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const DB_ENCRYPTION_KEY_KEY = 'dbEncryptionKey';

// expo-secure-store reads hit the OS Keychain/Keystore, which is slow enough
// to matter when several calls land back-to-back (a login-heavy flow makes
// several requests in quick succession). Each key's in-flight/last-resolved
// read is cached behind one shared promise with a sliding TTL: concurrent
// callers share the read, and after CACHE_TTL_MS of no activity the entry
// drops so the next read goes back to the keystore. A write updates the
// cache immediately instead of invalidating it, so a read right after a
// login/refresh doesn't force an extra round-trip.
const CACHE_TTL_MS = 3000;

interface CacheEntry {
  value: Promise<string | null>;
  timer: ReturnType<typeof setTimeout>;
}

const cache = new Map<string, CacheEntry>();

function cacheSet(key: string, value: Promise<string | null>): void {
  const existing = cache.get(key);
  if (existing) clearTimeout(existing.timer);
  cache.set(key, { value, timer: setTimeout(() => cache.delete(key), CACHE_TTL_MS) });
}

function cacheGet(key: string): Promise<string | null> | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => cache.delete(key), CACHE_TTL_MS);
  return entry.value;
}

function cacheClear(key: string): void {
  const existing = cache.get(key);
  if (existing) clearTimeout(existing.timer);
  cache.delete(key);
}

function read(key: string): Promise<string | null> {
  const cached = cacheGet(key);
  if (cached) return cached;
  const value = SecureStore.getItemAsync(key);
  cacheSet(key, value);
  return value;
}

async function write(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
  cacheSet(key, Promise.resolve(value));
}

async function remove(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
  cacheClear(key);
}

// Not touched by clear() — the local SQLite database (ADR 0026) must stay
// readable across the unconditional token clear every app restart performs
// (see AuthProvider), otherwise offline-first reads would break on cold
// start. A per-install key generated once and kept for the life of the
// install, same as the database file itself.
async function getOrCreateDbKey(): Promise<string> {
  const existing = await read(DB_ENCRYPTION_KEY_KEY);
  if (existing) return existing;
  const key = Crypto.randomUUID();
  await write(DB_ENCRYPTION_KEY_KEY, key);
  return key;
}

export const secureStorage = {
  getAccessToken: (): Promise<string | null> => read(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string): Promise<void> => write(ACCESS_TOKEN_KEY, token),
  getRefreshToken: (): Promise<string | null> => read(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string): Promise<void> => write(REFRESH_TOKEN_KEY, token),
  getOrCreateDbKey,
  clear: async (): Promise<void> => {
    await Promise.all([remove(ACCESS_TOKEN_KEY), remove(REFRESH_TOKEN_KEY)]);
  },
};
