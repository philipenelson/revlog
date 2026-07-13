import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import { act, renderHook, waitFor } from "@/test/renderViewModel";

const { push, clearSession, listVehicles, getCurrentUser, logoutRequest, loggerError, loggerWarn } = vi.hoisted(() => ({
  push: vi.fn(),
  clearSession: vi.fn(),
  listVehicles: vi.fn(),
  getCurrentUser: vi.fn(),
  logoutRequest: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/application/providers/AuthProvider", () => ({ useAuth: () => ({ clearSession }) }));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  listVehicles: (...a: unknown[]) => listVehicles(...a),
  getCurrentUser: (...a: unknown[]) => getCurrentUser(...a),
  logout: (...a: unknown[]) => logoutRequest(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({
  logger: { error: loggerError, warn: loggerWarn, info: vi.fn(), debug: vi.fn() },
}));

import { useGarageViewModel, deriveGarageFlags, initialsFromName, isLogoutNetworkFailure } from "./useGarageViewModel";

const vehicle = { id: "v1", nickname: "Blackbird", make: "Honda", model: "CB650R", year: 2019, mileage: 4200, photoUrl: null, logEntryCount: 3 };
const profile = { id: "u1", fullName: "Jordan Reyes", email: "jordan@example.com", role: "OWNER" };

beforeEach(() => {
  vi.clearAllMocks();
  listVehicles.mockReturnValue(new Promise(() => {}));
  getCurrentUser.mockReturnValue(new Promise(() => {}));
});

describe("useGarageViewModel (hook shell)", () => {
  it("starts in the loading state", () => {
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

describe("useGarageViewModel — accountMenu (hook shell)", () => {
  it("fetches the profile on mount and exposes it on the account menu", async () => {
    getCurrentUser.mockResolvedValue(profile);
    const { result } = renderHook(() => useGarageViewModel());
    await waitFor(() => expect(result.current.accountMenu.profile).toEqual(profile));
  });

  it("does not log a 4xx profile-fetch failure but does log a 5xx one", async () => {
    getCurrentUser.mockRejectedValue(new ApiError(500, {}));
    renderHook(() => useGarageViewModel());
    await waitFor(() => expect(loggerError).toHaveBeenCalled());
  });

  it("toggles and closes the menu", () => {
    const { result } = renderHook(() => useGarageViewModel());
    expect(result.current.accountMenu.isOpen).toBe(false);

    act(() => result.current.accountMenu.toggle());
    expect(result.current.accountMenu.isOpen).toBe(true);

    act(() => result.current.accountMenu.close());
    expect(result.current.accountMenu.isOpen).toBe(false);
  });

  it("logs out on success: clears the session and redirects to /login", async () => {
    logoutRequest.mockResolvedValue(undefined);
    const { result } = renderHook(() => useGarageViewModel());

    await act(async () => result.current.accountMenu.onLogout());

    expect(clearSession).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login");
    expect(result.current.accountMenu.logoutError).toBeNull();
  });

  it("completes logout locally on a server error response (e.g. already-invalid session)", async () => {
    logoutRequest.mockRejectedValue(new ApiError(401, {}));
    const { result } = renderHook(() => useGarageViewModel());

    await act(async () => result.current.accountMenu.onLogout());

    expect(clearSession).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("keeps the session and shows an error on a network failure", async () => {
    logoutRequest.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useGarageViewModel());

    await act(async () => result.current.accountMenu.onLogout());

    expect(clearSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(result.current.accountMenu.isLoggingOut).toBe(false);
    expect(result.current.accountMenu.logoutError).toBe("You need to be online to log out.");
    expect(loggerWarn).toHaveBeenCalled();
  });
});

describe("garage.logic — deriveGarageFlags", () => {
  it("is neither empty nor populated while loading", () => {
    expect(deriveGarageFlags("loading", 0)).toEqual({ isEmpty: false, isPopulated: false });
    expect(deriveGarageFlags("loading", 3)).toEqual({ isEmpty: false, isPopulated: false });
  });

  it("is neither empty nor populated on error", () => {
    expect(deriveGarageFlags("error", 0)).toEqual({ isEmpty: false, isPopulated: false });
  });

  it("is empty when loaded with no vehicles", () => {
    expect(deriveGarageFlags("loaded", 0)).toEqual({ isEmpty: true, isPopulated: false });
  });

  it("is populated when loaded with vehicles", () => {
    expect(deriveGarageFlags("loaded", 2)).toEqual({ isEmpty: false, isPopulated: true });
  });
});

describe("garage.logic — initialsFromName", () => {
  it("takes the first letter of the first and last name", () => {
    expect(initialsFromName("Jordan Reyes")).toBe("JR");
  });

  it("uppercases lowercase input", () => {
    expect(initialsFromName("jordan reyes")).toBe("JR");
  });

  it("falls back to the first two letters of a single-word name", () => {
    expect(initialsFromName("Jordan")).toBe("JO");
  });

  it("handles a middle name by using the first and last parts", () => {
    expect(initialsFromName("Jordan Q Reyes")).toBe("JR");
  });

  it("returns an empty string for empty input", () => {
    expect(initialsFromName("")).toBe("");
    expect(initialsFromName("   ")).toBe("");
  });
});

describe("garage.logic — isLogoutNetworkFailure", () => {
  it("is false for any ApiError (a server response)", () => {
    expect(isLogoutNetworkFailure(new ApiError(401, {}))).toBe(false);
    expect(isLogoutNetworkFailure(new ApiError(204, {}))).toBe(false);
  });

  it("is true for a non-ApiError (no server response)", () => {
    expect(isLogoutNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isLogoutNetworkFailure(new Error("timeout"))).toBe(true);
  });
});
