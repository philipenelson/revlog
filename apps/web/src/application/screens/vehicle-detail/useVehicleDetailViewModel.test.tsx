import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import { renderHook, act, waitFor } from "@/test/renderViewModel";

const { getVehicle, saveInsurance, initiateTransfer, cancelTransfer } = vi.hoisted(() => ({
  getVehicle: vi.fn(),
  saveInsurance: vi.fn(),
  initiateTransfer: vi.fn(),
  cancelTransfer: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ vehicleId: "v1" }) }));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  getVehicle: (...a: unknown[]) => getVehicle(...a),
  saveInsurance: (...a: unknown[]) => saveInsurance(...a),
  initiateTransfer: (...a: unknown[]) => initiateTransfer(...a),
  cancelTransfer: (...a: unknown[]) => cancelTransfer(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { useVehicleDetailViewModel } from "./useVehicleDetailViewModel";

const vehicle = {
  id: "v1",
  nickname: "Blackbird",
  make: "Honda",
  model: "CB650R",
  insurance: null,
  transferPending: false,
  pendingTransfer: null,
  logEntries: [
    { id: "1", typeId: "SERVICE" },
    { id: "2", typeId: "REPAIR" },
  ],
};

beforeEach(() => vi.clearAllMocks());

async function loaded() {
  getVehicle.mockResolvedValue(vehicle);
  const hook = renderHook(() => useVehicleDetailViewModel());
  await waitFor(() => expect(hook.result.current.loadState).toBe("loaded"));
  return hook;
}

describe("useVehicleDetailViewModel (hook shell)", () => {
  it("loads the vehicle and derives the display name", async () => {
    const { result } = await loaded();
    expect(result.current.displayName).toBe("Blackbird");
    expect(result.current.filteredEntries).toHaveLength(2);
  });

  it("shows not-found on a 403/404", async () => {
    getVehicle.mockRejectedValue(new ApiError(404, {}));
    const { result } = renderHook(() => useVehicleDetailViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("not-found"));
  });

  it("filters log entries by the selected type", async () => {
    const { result } = await loaded();
    act(() => result.current.setTypeFilter("SERVICE"));
    expect(result.current.filteredEntries.map((e) => e.id)).toEqual(["1"]);
  });

  it("opens and closes the insurance dialog with the requested edit mode", async () => {
    const { result } = await loaded();
    act(() => result.current.openInsurance(true));
    expect(result.current.insuranceOpen).toBe(true);
    expect(result.current.insuranceEditMode).toBe(true);
    act(() => result.current.closeInsurance());
    expect(result.current.insuranceOpen).toBe(false);
  });

  it("saves insurance and merges it into the vehicle", async () => {
    const { result } = await loaded();
    saveInsurance.mockResolvedValue({ company: "Acme" });
    await act(async () => {
      await result.current.handleInsuranceSave({ company: "Acme" } as never);
    });
    expect(result.current.vehicle?.insurance).toEqual({ company: "Acme" });
  });

  it("initiates a transfer, marking the vehicle pending and closing the dialog", async () => {
    const { result } = await loaded();
    initiateTransfer.mockResolvedValue({ recipientEmail: "buyer@x.com", expiresAt: "2026-08-01" });
    act(() => result.current.openTransferDialog());
    await act(async () => {
      await result.current.handleInitiateTransfer("buyer@x.com");
    });
    expect(result.current.vehicle?.transferPending).toBe(true);
    expect(result.current.vehicle?.pendingTransfer).toEqual({ recipientEmail: "buyer@x.com", expiresAt: "2026-08-01" });
    expect(result.current.transferDialogOpen).toBe(false);
  });

  it("cancels a pending transfer", async () => {
    getVehicle.mockResolvedValue({ ...vehicle, transferPending: true, pendingTransfer: { recipientEmail: "b@x.com", expiresAt: "z" } });
    const { result } = renderHook(() => useVehicleDetailViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("loaded"));
    cancelTransfer.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.handleCancelTransfer();
    });
    expect(result.current.vehicle?.transferPending).toBe(false);
    expect(result.current.vehicle?.pendingTransfer).toBeNull();
  });
});
