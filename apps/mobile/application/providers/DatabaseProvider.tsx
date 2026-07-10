import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { UserProfile } from '@maintenance-log/api-client';
import { openDatabase } from '@/infrastructure/database/openDatabase';
import { createSQLiteStore, createOutboxWriter } from '@/infrastructure/database/SQLiteStore';
import { vehiclesTable, outboxTable, logEntriesTable, userProfileTable } from '@/infrastructure/database/schema';
import { photoStore } from '@/infrastructure/storage/photoStorage';
import { createVehicleRepository, type VehicleRepository, type LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import {
  createOutboxRepository,
  type OutboxRepository,
  type OutboxEntry,
} from '@/domain/repositories/OutboxRepository';
import {
  createLogEntryRepository,
  type LogEntryRepository,
  type LocalLogEntry,
} from '@/domain/repositories/LogEntryRepository';
import { createProfileRepository, type ProfileRepository } from '@/domain/repositories/ProfileRepository';

interface DatabaseContextValue {
  isReady: boolean;
  vehicleRepository: VehicleRepository | null;
  outboxRepository: OutboxRepository | null;
  logEntryRepository: LogEntryRepository | null;
  // Optional so the many viewmodel-test useDatabase() mocks that predate the
  // profile cache keep type-checking; the real provider always supplies it.
  profileRepository?: ProfileRepository | null;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// Owns the async construction lifecycle for the local database (ADR 0026):
// opens the connection once, builds repositories on top of it, and exposes
// only the repositories via context — consumers never see Store or the raw
// connection. Mirrors AuthProvider's isRestoring pattern; mounted outermost
// in app/_layout.tsx since SyncProvider needs repositories to exist.
export function DatabaseProvider({ children }: PropsWithChildren) {
  const [value, setValue] = useState<DatabaseContextValue>({
    isReady: false,
    vehicleRepository: null,
    outboxRepository: null,
    logEntryRepository: null,
    profileRepository: null,
  });

  useEffect(() => {
    let cancelled = false;

    openDatabase().then((db) => {
      if (cancelled) return;
      const vehicleRepository = createVehicleRepository(
        createSQLiteStore<LocalVehicleDetail & { sortOrder: number }>(db, vehiclesTable),
        createOutboxWriter<LocalVehicleDetail & { sortOrder: number }>(db, vehiclesTable),
        photoStore,
      );
      const outboxRepository = createOutboxRepository(createSQLiteStore<OutboxEntry>(db, outboxTable));
      const logEntryRepository = createLogEntryRepository(
        createSQLiteStore<LocalLogEntry>(db, logEntriesTable),
        createOutboxWriter<LocalLogEntry>(db, logEntriesTable),
      );
      const profileRepository = createProfileRepository(createSQLiteStore<UserProfile>(db, userProfileTable));
      setValue({ isReady: true, vehicleRepository, outboxRepository, logEntryRepository, profileRepository });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used within a DatabaseProvider');
  return ctx;
}
