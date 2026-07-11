// Pure functional core for the Garage screen (ADR 0043).

export type GarageLoadState = "loading" | "loaded" | "error";

// The empty/populated flags the view branches on. Both are false until the load
// settles as "loaded", so the view shows neither the empty state nor the grid
// while loading or on error.
export function deriveGarageFlags(
  loadState: GarageLoadState,
  vehicleCount: number,
): { isEmpty: boolean; isPopulated: boolean } {
  const hasLoaded = loadState === "loaded";
  const isEmpty = hasLoaded && vehicleCount === 0;
  return { isEmpty, isPopulated: hasLoaded && !isEmpty };
}
