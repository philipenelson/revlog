// Pure functional core for the Garage screen (ADR 0043).

// A seeded local table renders immediately (no spinner) regardless of sync
// (UC-MOB-GARAGE-1). An empty table shows loading only until the first sync
// attempt concludes — success or failure — after which an empty result is a
// real, renderable empty state (UC-MOB-GARAGE-2).
export function deriveGarageLoading(
  vehicleCount: number,
  lastSyncedAt: Date | null,
  syncStatus: string,
): boolean {
  const hasCompletedOneSyncAttempt = lastSyncedAt !== null || syncStatus === 'error';
  return vehicleCount === 0 && !hasCompletedOneSyncAttempt;
}
