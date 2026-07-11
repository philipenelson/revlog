import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChangeEvent, FormEvent } from "react";
import { ApiError } from "@maintenance-log/api-client";
import { renderHook, act } from "@/test/renderViewModel";
import type { VehicleDraft } from "@/domain/types";

const { push, createVehicle, createVehicleWithPhoto, loggerError } = vi.hoisted(() => ({
  push: vi.fn(),
  createVehicle: vi.fn(),
  createVehicleWithPhoto: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  createVehicle: (...a: unknown[]) => createVehicle(...a),
  createVehicleWithPhoto: (...a: unknown[]) => createVehicleWithPhoto(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useAddVehicleViewModel } from "./useAddVehicleViewModel";

const change = (value: string) => ({ target: { value } }) as ChangeEvent<HTMLInputElement>;
const formEvent = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent;

function fill(result: { current: ReturnType<typeof useAddVehicleViewModel> }, draft: Partial<VehicleDraft>) {
  act(() => {
    for (const [k, v] of Object.entries(draft)) {
      result.current.updateField(k as keyof VehicleDraft)(change(v));
    }
  });
}

const validDraft: VehicleDraft = { nickname: "", make: "Honda", model: "CB650R", year: "2019", mileage: "4200" };

beforeEach(() => vi.clearAllMocks());

describe("useAddVehicleViewModel (hook shell)", () => {
  it("derives displayName and isComplete from the draft", () => {
    const { result } = renderHook(() => useAddVehicleViewModel());
    expect(result.current.displayName).toBeNull();
    expect(result.current.isComplete).toBe(false);
    fill(result, validDraft);
    expect(result.current.displayName).toBe("Honda CB650R");
    expect(result.current.isComplete).toBe(true);
  });

  it("blocks submit and surfaces field errors when the draft is invalid", async () => {
    const { result } = renderHook(() => useAddVehicleViewModel());
    await act(async () => {
      await result.current.handleSubmit(formEvent());
    });
    expect(createVehicle).not.toHaveBeenCalled();
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);
  });

  it("creates the vehicle and navigates to the garage on success", async () => {
    createVehicle.mockResolvedValue({ id: "v1" });
    const { result } = renderHook(() => useAddVehicleViewModel());
    fill(result, validDraft);
    await act(async () => {
      await result.current.handleSubmit(formEvent());
    });
    expect(createVehicle).toHaveBeenCalledWith(expect.anything(), {
      nickname: undefined,
      make: "Honda",
      model: "CB650R",
      year: 2019,
      mileage: 4200,
    });
    expect(push).toHaveBeenCalledWith("/garage");
  });

  it("shows the friendly save error on a 4xx", async () => {
    createVehicle.mockRejectedValue(new ApiError(422, {}));
    const { result } = renderHook(() => useAddVehicleViewModel());
    fill(result, validDraft);
    await act(async () => {
      await result.current.handleSubmit(formEvent());
    });
    expect(result.current.submitError).toMatch(/Couldn't save your vehicle/);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("logs and shows the service error on a 5xx", async () => {
    createVehicle.mockRejectedValue(new ApiError(500, {}));
    const { result } = renderHook(() => useAddVehicleViewModel());
    fill(result, validDraft);
    await act(async () => {
      await result.current.handleSubmit(formEvent());
    });
    expect(result.current.submitError).toMatch(/We stalled/);
    expect(loggerError).toHaveBeenCalled();
  });
});
