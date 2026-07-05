import * as SecureStore from 'expo-secure-store';
import type { AccountStatus } from '@maintenance-log/domain';

// Keychain/Keystore-backed store for the Owner's login credentials plus the
// session-identity fields needed to rebuild a Session offline (ADR 0036).
//
// This is a deliberate carve-out separate from secureStorage.ts: those keys
// (accessToken/refreshToken) are cleared on every cold start (UC-MOB-AUTH-7),
// but this key must SURVIVE that clear so the Owner can sign in offline or via
// biometrics on the next launch — the same treatment the DB encryption key
// gets. It is removed only on explicit logout (see AuthProvider.clearSession).
//
// The password is stored in plaintext (in the OS-encrypted Keychain/Keystore):
// biometric unlock and the offline→online silent re-auth both replay
// POST /auth/login, which needs the plaintext. See ADR 0036 for the tradeoff.
const CREDENTIAL_KEY = 'authCredential';

/** The Session fields that are not tokens — enough to rebuild a token-less offline Session. */
export interface StoredIdentity {
  userId: string;
  accountId: string;
  role: string;
  accountStatus: AccountStatus;
}

export interface StoredCredential extends StoredIdentity {
  email: string;
  password: string;
}

function isStoredCredential(value: unknown): value is StoredCredential {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.email === 'string' &&
    typeof c.password === 'string' &&
    typeof c.userId === 'string' &&
    typeof c.accountId === 'string' &&
    typeof c.role === 'string' &&
    (c.accountStatus === 'ONBOARDING' || c.accountStatus === 'ACTIVE')
  );
}

export const credentialStore = {
  // Called after a successful ONLINE login — captures the credentials and
  // identity so future offline/biometric sign-ins can reuse them.
  async save(credential: StoredCredential): Promise<void> {
    await SecureStore.setItemAsync(CREDENTIAL_KEY, JSON.stringify(credential));
  },

  // Returns null when nothing is stored or the blob is malformed, so callers
  // never act on a partial credential.
  async get(): Promise<StoredCredential | null> {
    const raw = await SecureStore.getItemAsync(CREDENTIAL_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isStoredCredential(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  async has(): Promise<boolean> {
    return (await credentialStore.get()) !== null;
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(CREDENTIAL_KEY);
  },
};
