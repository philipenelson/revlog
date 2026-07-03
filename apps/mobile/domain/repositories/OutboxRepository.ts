import * as Crypto from 'expo-crypto';
import type { Store } from '@/infrastructure/database/Store';

export type OutboxStatus = 'pending' | 'processing' | 'failed';

// Schema per ADR 0027 — id doubles as the idempotency key, payload is a JSON
// string of the mutation data.
export interface OutboxEntry {
  id: string;
  type: string;
  payload: string;
  createdAt: number;
  status: OutboxStatus;
}

export interface OutboxRepository {
  enqueue(type: string, payload: unknown): Promise<void>;
  listPending(): Promise<OutboxEntry[]>;
  markStatus(id: string, status: OutboxStatus): Promise<void>;
  remove(id: string): Promise<void>;
}

// Shared with infrastructure/database/SQLiteStore.ts's createOutboxWriter —
// the same entry shape whether it's written via this repository's own store
// or atomically alongside another table's row (ADR 0027's 2026-07-03
// update).
export function buildOutboxEntry(type: string, payload: unknown): OutboxEntry {
  return {
    id: Crypto.randomUUID(),
    type,
    payload: JSON.stringify(payload),
    createdAt: Date.now(),
    status: 'pending',
  };
}

export function createOutboxRepository(store: Store<OutboxEntry>): OutboxRepository {
  return {
    async enqueue(type: string, payload: unknown): Promise<void> {
      await store.save(buildOutboxEntry(type, payload));
    },

    async listPending(): Promise<OutboxEntry[]> {
      return store.getAll({ where: { status: 'pending' }, orderBy: { field: 'createdAt', direction: 'asc' } });
    },

    async markStatus(id: string, status: OutboxStatus): Promise<void> {
      const [entry] = await store.getAll({ where: { id } });
      if (!entry) return;
      await store.save({ ...entry, status });
    },

    async remove(id: string): Promise<void> {
      await store.remove(id);
    },
  };
}
