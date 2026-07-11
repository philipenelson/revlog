// Pure functional core for the Vehicle Detail screen (ADR 0043).

// loading until the first local read completes; then loaded if the vehicle was
// found, not-found otherwise.
export function deriveDetailLoadState(
  hasLoadedOnce: boolean,
  hasVehicle: boolean,
): 'loading' | 'loaded' | 'not-found' {
  if (!hasLoadedOnce) return 'loading';
  return hasVehicle ? 'loaded' : 'not-found';
}

// The log-entry count chip: the number, or "None" when there are no entries.
export function entryCountText(count: number): string {
  return count > 0 ? String(count) : 'None';
}
