import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FormEvent } from "react";
import { ApiError } from "@maintenance-log/api-client";
import { renderHook, act, waitFor } from "@/test/renderViewModel";

const { push, getVehicle, updateVehicle, setVehiclePhoto, deleteVehicle, loggerError } = vi.hoisted(() => ({
  push: vi.fn(),
  getVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  setVehiclePhoto: vi.fn(),
  deleteVehicle: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ vehicleId: "v1" }),
}));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  getVehicle: (...a: unknown[]) => getVehicle(...a),
  updateVehicle: (...a: unknown[]) => updateVehicle(...a),
  setVehiclePhoto: (...a: unknown[]) => setVehiclePhoto(...a),
  deleteVehicle: (...a: unknown[]) => deleteVehicle(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useEditVehicleViewModel } from "./useEditVehicleViewModel";

const savedVehicle = {
  id: "v1",
  nickname: "Blackbird",
  make: "Honda",
  model: "CB650R",
  year: 2019,
  mileage: 4200,
  photoUrl: "https://cdn/x.jpg",
};
const formEvent = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent;

beforeEach(() => vi.clearAllMocks());

describe("useEditVehicleViewModel (hook shell)", () => {
  it("loads the vehicle and populates fields + display name", async () => {
    getVehicle.mockResolvedValue(savedVehicle);
    const { result } = renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    expect(result.current.fields).toEqual({ nickname: "Blackbird", make: "Honda", model: "CB650R", year: "2019", mileage: "4200" });
    expect(result.current.vehicleDisplayName).toBe("Blackbird");
    expect(result.current.photoPreviewUrl).toBe("https://cdn/x.jpg");
  });

  it("shows not-found on a 403/404 load failure", async () => {
    getVehicle.mockRejectedValue(new ApiError(404, {}));
    const { result } = renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("not-found"));
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("shows error and logs on a 5xx load failure", async () => {
    getVehicle.mockRejectedValue(new ApiError(500, {}));
    const { result } = renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("error"));
    expect(loggerError).toHaveBeenCalled();
  });

  it("saves changes and navigates to the vehicle on success", async () => {
    getVehicle.mockResolvedValue(savedVehicle);
    updateVehicle.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    await act(async () => {
      await result.current.handleSubmit(formEvent());
    });
    expect(updateVehicle).toHaveBeenCalledWith(expect.anything(), "v1", {
      nickname: "Blackbird",
      make: "Honda",
      model: "CB650R",
      year: 2019,
      mileage: 4200,
    });
    expect(push).toHaveBeenCalledWith("/garage/v1");
  });

  it("opens and closes the delete dialog", async () => {
    getVehicle.mockResolvedValue(savedVehicle);
    const { result } = renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    act(() => result.current.openDeleteDialog());
    expect(result.current.deleteDialogOpen).toBe(true);
    act(() => result.current.closeDeleteDialog());
    expect(result.current.deleteDialogOpen).toBe(false);
  });

  it("deletes the vehicle and returns to the garage", async () => {
    getVehicle.mockResolvedValue(savedVehicle);
    deleteVehicle.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEditVehicleViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    await act(async () => {
      await result.current.handleDelete();
    });
    expect(deleteVehicle).toHaveBeenCalledWith(expect.anything(), "v1");
    expect(push).toHaveBeenCalledWith("/garage");
  });
});
