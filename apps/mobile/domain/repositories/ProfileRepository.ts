import type { UserProfile } from '@maintenance-log/api-client';
import type { Store } from '@/domain/ports/Store';

export interface ProfileRepository {
  get(): Promise<UserProfile | null>;
  save(profile: UserProfile): Promise<void>;
}

// Offline-first cache of the signed-in user's profile (GET /users/me, ADR
// 0033). SyncService.pull() writes it via save(); the Settings viewmodel
// reads it via get() so the Account section renders from cache and survives
// going offline. Read-only pull — identity is never mutated locally, so
// there is no outbox involvement (name/email/password changes are a separate
// online, OTP-confirmed flow). save() replaces the whole collection so a
// different user logging in never leaves the previous user's row behind.
export function createProfileRepository(store: Store<UserProfile>): ProfileRepository {
  return {
    async get(): Promise<UserProfile | null> {
      const rows = await store.getAll();
      return rows[0] ?? null;
    },
    async save(profile: UserProfile): Promise<void> {
      await store.replaceAll([profile]);
    },
  };
}
