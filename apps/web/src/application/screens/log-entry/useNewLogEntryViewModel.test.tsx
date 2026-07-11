import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@/test/renderViewModel";

const { push, createLogEntry, mediaSave } = vi.hoisted(() => ({
  push: vi.fn(),
  createLogEntry: vi.fn(),
  mediaSave: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ vehicleId: "v1" }),
}));
vi.mock("@/adapters/media/useMediaStore", () => ({
  useMediaStore: () => ({ save: mediaSave, getUrl: vi.fn(), delete: vi.fn(), listForEntry: vi.fn() }),
}));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  createLogEntry: (...a: unknown[]) => createLogEntry(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));

import { useNewLogEntryViewModel } from "./useNewLogEntryViewModel";

beforeEach(() => vi.clearAllMocks());

describe("useNewLogEntryViewModel (hook shell)", () => {
  it("exposes the vehicleId from the route", () => {
    const { result } = renderHook(() => useNewLogEntryViewModel());
    expect(result.current.vehicleId).toBe("v1");
  });

  it("creates the entry and returns to the vehicle on success", async () => {
    createLogEntry.mockResolvedValue({ id: "e1" });
    const { result } = renderHook(() => useNewLogEntryViewModel());
    await act(async () => {
      await result.current.handleSave();
    });
    expect(createLogEntry).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/garage/v1");
    expect(result.current.error).toBeNull();
  });

  it("surfaces the thrown error message on failure", async () => {
    createLogEntry.mockRejectedValue(new Error("Server said no"));
    const { result } = renderHook(() => useNewLogEntryViewModel());
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.error).toBe("Server said no");
    expect(push).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for a non-Error throw", async () => {
    createLogEntry.mockRejectedValue("nope");
    const { result } = renderHook(() => useNewLogEntryViewModel());
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.error).toMatch(/Something went wrong/);
  });
});
