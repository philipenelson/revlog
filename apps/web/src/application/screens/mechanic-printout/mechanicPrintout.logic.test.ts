import { describe, it, expect } from "vitest";
import type { MechanicPrintout } from "@maintenance-log/api-client";
import { printoutDisplayName } from "./useMechanicPrintoutViewModel";

describe("mechanicPrintout.logic — printoutDisplayName", () => {
  it("falls back to 'Service History' before the printout loads", () => {
    expect(printoutDisplayName(null)).toBe("Service History");
  });

  it("uses the vehicle's display name once loaded", () => {
    const printout = { vehicle: { nickname: "Blackbird", make: "Honda", model: "CB650R" } } as MechanicPrintout;
    expect(printoutDisplayName(printout)).toBe("Blackbird");
  });

  it("falls back to make + model when the vehicle has no nickname", () => {
    const printout = { vehicle: { nickname: null, make: "Honda", model: "CB650R" } } as MechanicPrintout;
    expect(printoutDisplayName(printout)).toBe("Honda CB650R");
  });
});
