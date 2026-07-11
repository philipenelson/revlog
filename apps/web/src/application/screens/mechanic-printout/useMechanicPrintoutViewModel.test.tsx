import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@/test/renderViewModel";

const { getMechanicPrintout, loggerError } = vi.hoisted(() => ({
  getMechanicPrintout: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  getMechanicPrintout: (...a: unknown[]) => getMechanicPrintout(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import type { MechanicPrintout } from "@maintenance-log/api-client";
import { useMechanicPrintoutViewModel, printoutDisplayName } from "./useMechanicPrintoutViewModel";

beforeEach(() => vi.clearAllMocks());

describe("useMechanicPrintoutViewModel (hook shell)", () => {
  it("loads the printout and derives the display name", async () => {
    getMechanicPrintout.mockResolvedValue({ vehicle: { nickname: "Blackbird", make: "Honda", model: "CB650R" } });
    const { result } = renderHook(() => useMechanicPrintoutViewModel("tok"));
    await waitFor(() => expect(result.current.loadState).toBe("loaded"));
    expect(result.current.displayName).toBe("Blackbird");
  });

  it("shows not-found when the token resolves to nothing", async () => {
    getMechanicPrintout.mockResolvedValue(null);
    const { result } = renderHook(() => useMechanicPrintoutViewModel("tok"));
    await waitFor(() => expect(result.current.loadState).toBe("not-found"));
    expect(result.current.displayName).toBe("Service History");
  });

  it("enters the error state and logs on failure", async () => {
    getMechanicPrintout.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useMechanicPrintoutViewModel("tok"));
    await waitFor(() => expect(result.current.loadState).toBe("error"));
    expect(loggerError).toHaveBeenCalled();
  });
});

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
