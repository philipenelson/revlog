import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChangeEvent, FormEvent } from "react";
import { ApiError } from "@maintenance-log/api-client";
import { renderHook, act } from "@/test/renderViewModel";
import type { VehicleDraft } from "@/domain/types";

const { push, createVehicle, skipOnboarding, getSession, setSession, loggerError } = vi.hoisted(() => ({
  push: vi.fn(),
  createVehicle: vi.fn(),
  skipOnboarding: vi.fn(),
  getSession: vi.fn(),
  setSession: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  createVehicle: (...a: unknown[]) => createVehicle(...a),
  createVehicleWithPhoto: vi.fn(),
  skipOnboarding: (...a: unknown[]) => skipOnboarding(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/session/sessionStore", () => ({ sessionStore: { getSession, setSession } }));
vi.mock("@/adapters/logging/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useOnboardingViewModel } from "./useOnboardingViewModel";

const change = (value: string) => ({ target: { value } }) as ChangeEvent<HTMLInputElement>;
const formEvent = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent;
const validDraft: VehicleDraft = { nickname: "Blackbird", make: "Honda", model: "CB650R", year: "2019", mileage: "4200" };

function fill(result: { current: ReturnType<typeof useOnboardingViewModel> }, draft: VehicleDraft) {
  act(() => {
    for (const [k, v] of Object.entries(draft)) {
      result.current.updateField(k as keyof VehicleDraft)(change(v));
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockReturnValue({ account: { status: "ONBOARDING" } });
});

describe("useOnboardingViewModel (hook shell)", () => {
  it("moves between the welcome and vehicle steps", () => {
    const { result } = renderHook(() => useOnboardingViewModel());
    expect(result.current.step).toBe(1);
    act(() => result.current.goToVehicleStep());
    expect(result.current.step).toBe(2);
    act(() => result.current.goBackToWelcome());
    expect(result.current.step).toBe(1);
  });

  it("creates the vehicle, activates the account, and advances to the ready step", async () => {
    createVehicle.mockResolvedValue({ id: "v1" });
    const { result } = renderHook(() => useOnboardingViewModel());
    fill(result, validDraft);
    await act(async () => {
      await result.current.handleContinue(formEvent());
    });
    expect(createVehicle).toHaveBeenCalled();
    expect(setSession).toHaveBeenCalledWith(expect.objectContaining({ account: { status: "ACTIVE" } }));
    expect(result.current.step).toBe(3);
    expect(result.current.readyHeadline).toBe("Blackbird is in your garage");
  });

  it("blocks continue on an invalid draft", async () => {
    const { result } = renderHook(() => useOnboardingViewModel());
    await act(async () => {
      await result.current.handleContinue(formEvent());
    });
    expect(createVehicle).not.toHaveBeenCalled();
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);
  });

  it("skips onboarding and routes to the garage", async () => {
    skipOnboarding.mockResolvedValue(undefined);
    const { result } = renderHook(() => useOnboardingViewModel());
    await act(async () => {
      await result.current.handleSkip();
    });
    expect(skipOnboarding).toHaveBeenCalled();
    expect(setSession).toHaveBeenCalledWith(expect.objectContaining({ account: { status: "ACTIVE" } }));
    expect(push).toHaveBeenCalledWith("/garage");
  });

  it("shows the skip error on a 4xx failure", async () => {
    skipOnboarding.mockRejectedValue(new ApiError(400, {}));
    const { result } = renderHook(() => useOnboardingViewModel());
    await act(async () => {
      await result.current.handleSkip();
    });
    expect(result.current.skipError).toMatch(/Couldn't skip onboarding/);
  });
});
