import type { LogEntrySummary } from "@maintenance-log/api-client";

// Pure core for the Vehicle Detail screen (ADR 0043).

// The log entries shown for the active type filter: "ALL" shows everything,
// otherwise only entries of that type. Deterministic given the inputs.
export function filterLogEntries(entries: LogEntrySummary[], typeFilter: string): LogEntrySummary[] {
  return typeFilter === "ALL" ? entries : entries.filter((e) => e.typeId === typeFilter);
}
