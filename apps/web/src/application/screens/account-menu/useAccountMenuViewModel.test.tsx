import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import { act, renderHook, waitFor } from "@/test/renderViewModel";

const { push, clearSession, getCurrentUser, logoutRequest, loggerError, loggerWarn } = vi.hoisted(() => ({
  push: vi.fn(),
  clearSession: vi.fn(),
  getCurrentUser: vi.fn(),
  logoutRequest: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/application/providers/AuthProvider", () => ({ useAuth: () => ({ clearSession }) }));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  getCurrentUser: (...a: unknown[]) => getCurrentUser(...a),
  logout: (...a: unknown[]) => logoutRequest(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({
  logger: { error: loggerError, warn: loggerWarn, info: vi.fn(), debug: vi.fn() },
}));

import { useAccountMenuViewModel, initialsFromName, isLogoutNetworkFailure } from "./useAccountMenuViewModel";

const profile = { id: "u1", fullName: "Jordan Reyes", email: "jordan@example.com", role: "OWNER" };

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockReturnValue(new Promise(() => {}));
});

describe("useAccountMenuViewModel (hook shell)", () => {
  it("fetches the profile on mount and exposes it", async () => {
    getCurrentUser.mockResolvedValue(profile);
    const { result } = renderHook(() => useAccountMenuViewModel());
    await waitFor(() => expect(result.current.profile).toEqual(profile));
  });

  it("does not log a 4xx profile-fetch failure but does log a 5xx one", async () => {
    getCurrentUser.mockRejectedValue(new ApiError(500, {}));
    renderHook(() => useAccountMenuViewModel());
    await waitFor(() => expect(loggerError).toHaveBeenCalled());
  });

  it("toggles and closes the menu", () => {
    const { result } = renderHook(() => useAccountMenuViewModel());
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it("logs out on success: clears the session and redirects to /login", async () => {
    logoutRequest.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccountMenuViewModel());

    await act(async () => result.current.onLogout());

    expect(clearSession).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login");
    expect(result.current.logoutError).toBeNull();
  });

  it("completes logout locally on a server error response (e.g. already-invalid session)", async () => {
    logoutRequest.mockRejectedValue(new ApiError(401, {}));
    const { result } = renderHook(() => useAccountMenuViewModel());

    await act(async () => result.current.onLogout());

    expect(clearSession).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("keeps the session and shows an error on a network failure", async () => {
    logoutRequest.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useAccountMenuViewModel());

    await act(async () => result.current.onLogout());

    expect(clearSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(result.current.isLoggingOut).toBe(false);
    expect(result.current.logoutError).toBe("You need to be online to log out.");
    expect(loggerWarn).toHaveBeenCalled();
  });
});

describe("account-menu.logic — initialsFromName", () => {
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

describe("account-menu.logic — isLogoutNetworkFailure", () => {
  it("is false for any ApiError (a server response)", () => {
    expect(isLogoutNetworkFailure(new ApiError(401, {}))).toBe(false);
    expect(isLogoutNetworkFailure(new ApiError(204, {}))).toBe(false);
  });

  it("is true for a non-ApiError (no server response)", () => {
    expect(isLogoutNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isLogoutNetworkFailure(new Error("timeout"))).toBe(true);
  });
});
