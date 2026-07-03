import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { openDatabase } from '@/infrastructure/database/openDatabase';
import { createSQLiteStore } from '@/infrastructure/database/SQLiteStore';
import { vehiclesTable, outboxTable, logEntriesTable } from '@/infrastructure/database/schema';
import { createVehicleRepository, type VehicleRepository, type LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import {
  createOutboxRepository,
  type OutboxRepository,
  type OutboxEntry,
} from '@/domain/repositories/OutboxRepository';
import { createLogEntryRepository, type LogEntryRepository } from '@/domain/repositories/LogEntryRepository';
import type { LogEntrySummary } from '@maintenance-log/api-client';

interface DatabaseContextValue {
  isReady: boolean;
  vehicleRepository: VehicleRepository | null;
  outboxRepository: OutboxRepository | null;
  logEntryRepository: LogEntryRepository | null;
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
  });

  useEffect(() => {
    let cancelled = false;

    openDatabase().then((db) => {
      if (cancelled) return;
      const vehicleRepository = createVehicleRepository(
        createSQLiteStore<LocalVehicleDetail & { sortOrder: number }>(db, vehiclesTable),
      );
      const outboxRepository = createOutboxRepository(createSQLiteStore<OutboxEntry>(db, outboxTable));
      const logEntryRepository = createLogEntryRepository(
        createSQLiteStore<LogEntrySummary & { vehicleId: string }>(db, logEntriesTable),
      );
      setValue({ isReady: true, vehicleRepository, outboxRepository, logEntryRepository });
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
