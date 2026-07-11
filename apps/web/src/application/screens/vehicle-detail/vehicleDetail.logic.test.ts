import { describe, it, expect } from "vitest";
import type { LogEntrySummary } from "@maintenance-log/api-client";
import { filterLogEntries } from "./useVehicleDetailViewModel";

const entry = (id: string, typeId: string) => ({ id, typeId }) as LogEntrySummary;
const entries = [entry("1", "SERVICE"), entry("2", "REPAIR"), entry("3", "SERVICE")];

describe("vehicleDetail.logic — filterLogEntries", () => {
  it("returns every entry for the ALL filter", () => {
    expect(filterLogEntries(entries, "ALL")).toBe(entries);
  });

  it("returns only entries matching the selected type", () => {
    expect(filterLogEntries(entries, "SERVICE").map((e) => e.id)).toEqual(["1", "3"]);
    expect(filterLogEntries(entries, "REPAIR").map((e) => e.id)).toEqual(["2"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterLogEntries(entries, "INSPECTION")).toEqual([]);
  });
});
