import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { tokenHttpClient } from '@/infrastructure/http/TokenHttpClient';
import { useAuth } from '@/application/providers/AuthProvider';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import { createSyncService } from '@/infrastructure/sync/SyncService';
import { createOutboxHandlers } from '@/infrastructure/sync/outboxHandlers';
import { logger } from '@/infrastructure/logging/logger';

type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncContextValue {
  isOnline: boolean;
  pendingCount: number;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  refresh(): Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

// Mounted inside DatabaseProvider (needs repositories) and AuthProvider
// (needs the session) in app/_layout.tsx. Triggers a full sync (flush then
// pull, per ADR 0027) on mount, on reconnect, and on app foreground — never
// while unauthenticated or before the local database is ready.
export function SyncProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const { isReady, vehicleRepository, outboxRepository, logEntryRepository, profileRepository } = useDatabase();
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected ?? true;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const wasOnline = useRef(isOnline);

  // Single-flight, mirroring TokenHttpClient's refreshOnce() -- mount,
  // reconnect, app-foreground, and an explicit pull-to-refresh can all fire
  // close together with no other coordination between them. Without this,
  // two overlapping runFullSync() calls can both pick up the same pending
  // outbox entry (SyncService.flushOutbox() has no cross-call locking
  // either): harmless for a plain CREATE_VEHICLE/UPDATE_VEHICLE (idempotent
  // upsert/PATCH), but for a photo upload, one call's success can delete the
  // local stable-storage file (see outboxHandlers.ts) out from under the
  // other call's still-in-flight read of that same file, surfacing as a
  // spurious "no such file" failure. See ADR 0027's 2026-07-03 update.
  const syncInFlight = useRef<Promise<void> | null>(null);

  function runFullSync(): Promise<void> {
    syncInFlight.current ??= performSync().finally(() => {
      syncInFlight.current = null;
    });
    return syncInFlight.current;
  }

  async function performSync(): Promise<void> {
    if (!isReady || !vehicleRepository || !outboxRepository || !logEntryRepository || !session) return;

    setSyncStatus('syncing');
    const service = createSyncService({
      client: tokenHttpClient,
      vehicleRepository,
      logEntryRepository,
      outboxRepository,
      handlers: createOutboxHandlers(tokenHttpClient),
      profileRepository: profileRepository ?? undefined,
    });

    try {
      await service.runFullSync();
      setLastSyncedAt(new Date());
      setSyncStatus('idle');
    } catch (err) {
      logger.error('sync: full sync failed', { err: String(err) });
      setSyncStatus('error');
    }

    setPendingCount((await outboxRepository.listPending()).length);
  }

  // On mount, and whenever the database becomes ready or the signed-in user
  // changes (covers login/logout — not every session refresh, which keeps
  // the same user.id).
  useEffect(() => {
    void runFullSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, session?.user.id]);

  // On reconnect.
  useEffect(() => {
    if (isOnline && !wasOnline.current) void runFullSync();
    wasOnline.current = isOnline;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // On app foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runFullSync();
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, session?.user.id]);

  const value: SyncContextValue = { isOnline, pendingCount, syncStatus, lastSyncedAt, refresh: runFullSync };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}
