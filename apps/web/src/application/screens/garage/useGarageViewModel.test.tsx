import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import { renderHook, waitFor } from "@/test/renderViewModel";

const { listVehicles, loggerError } = vi.hoisted(() => ({
  listVehicles: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  listVehicles: (...a: unknown[]) => listVehicles(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useGarageViewModel } from "./useGarageViewModel";

const vehicle = { id: "v1", nickname: "Blackbird", make: "Honda", model: "CB650R", year: 2019, mileage: 4200, photoUrl: null, logEntryCount: 3 };

beforeEach(() => vi.clearAllMocks());

describe("useGarageViewModel (hook shell)", () => {
  it("starts in the loading state", () => {
    listVehicles.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useGarageViewModel());
    expect(result.current.loadState).toBe("loading");
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.isPopulated).toBe(false);
  });

  it("loads and marks populated when vehicles come back", async () => {
    listVehicles.mockResolvedValue([vehicle]);
    const { result } = renderHook(() => useGarageViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("loaded"));
    expect(result.current.vehicles).toEqual([vehicle]);
    expect(result.current.isPopulated).toBe(true);
    expect(result.current.isEmpty).toBe(false);
  });

  it("loads and marks empty when no vehicles come back", async () => {
    listVehicles.mockResolvedValue([]);
    const { result } = renderHook(() => useGarageViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("loaded"));
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.isPopulated).toBe(false);
  });

  it("enters the error state and logs a 5xx failure", async () => {
    listVehicles.mockRejectedValue(new ApiError(500, {}));
    const { result } = renderHook(() => useGarageViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("error"));
    expect(loggerError).toHaveBeenCalled();
  });

  it("enters the error state without logging a 4xx failure", async () => {
    listVehicles.mockRejectedValue(new ApiError(401, {}));
    const { result } = renderHook(() => useGarageViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("error"));
    expect(loggerError).not.toHaveBeenCalled();
  });
});
