import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { openDatabase } from '@/infrastructure/database/openDatabase';
import { createSQLiteStore } from '@/infrastructure/database/SQLiteStore';
import { vehiclesTable, outboxTable } from '@/infrastructure/database/schema';
import { createVehicleRepository, type VehicleRepository } from '@/domain/repositories/VehicleRepository';
import {
  createOutboxRepository,
  type OutboxRepository,
  type OutboxEntry,
} from '@/domain/repositories/OutboxRepository';
import type { VehicleSummary } from '@maintenance-log/api-client';

interface DatabaseContextValue {
  isReady: boolean;
  vehicleRepository: VehicleRepository | null;
  outboxRepository: OutboxRepository | null;
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
  });

  useEffect(() => {
    let cancelled = false;

    openDatabase().then((db) => {
      if (cancelled) return;
      const vehicleRepository = createVehicleRepository(
        createSQLiteStore<VehicleSummary & { sortOrder: number }>(db, vehiclesTable),
      );
      const outboxRepository = createOutboxRepository(createSQLiteStore<OutboxEntry>(db, outboxTable));
      setValue({ isReady: true, vehicleRepository, outboxRepository });
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
