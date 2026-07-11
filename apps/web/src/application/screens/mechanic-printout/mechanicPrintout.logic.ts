import type { MechanicPrintout } from "@maintenance-log/api-client";
import { vehicleDisplayName } from "@/domain/types";

// Pure core for the public mechanic-printout screen (ADR 0043).

// The heading: the vehicle's display name once loaded, or a neutral fallback
// while loading / when the share link is unknown.
export function printoutDisplayName(printout: MechanicPrintout | null): string {
  return printout ? vehicleDisplayName(printout.vehicle) : "Service History";
}
