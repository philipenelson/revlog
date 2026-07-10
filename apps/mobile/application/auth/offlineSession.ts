import type { Session } from '@maintenance-log/api-client';
import type { LoginInput } from '@maintenance-log/contracts';
import type { StoredCredential } from '@/adapters/storage/credentialStore';

// Pure mappings between a Session, login credentials, and the stored-credential
// blob (ADR 0036). Kept in a leaf module (no React, no provider imports) so
// both useSignIn and AuthProvider can share them without a circular import.

// Rebuild a token-less Session from stored identity. The empty accessToken is
// the offline marker: AuthProvider surfaces it as isOffline and SyncProvider
// defers network I/O until a real session replaces it.
export function buildOfflineSession(stored: StoredCredential): Session {
  return {
    accessToken: '',
    accessTokenExpiresAt: new Date(0).toISOString(),
    user: { id: stored.userId, accountId: stored.accountId, role: stored.role },
    account: { id: stored.accountId, status: stored.accountStatus },
  };
}

// The blob to persist after a successful online login — the credentials plus
// the Session identity fields needed to reconstruct an offline session later.
export function credentialForStore(credentials: LoginInput, session: Session): StoredCredential {
  return {
    email: credentials.email,
    password: credentials.password,
    userId: session.user.id,
    accountId: session.account.id,
    role: session.user.role,
    accountStatus: session.account.status,
  };
}
