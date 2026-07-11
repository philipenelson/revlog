import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import { renderHook, act, waitFor } from "@/test/renderViewModel";

const { push, replace, getTransferDetails, acceptTransfer, declineTransfer } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  getTransferDetails: vi.fn(),
  acceptTransfer: vi.fn(),
  declineTransfer: vi.fn(),
}));

let auth: { session: unknown; isRestoring: boolean };
// A stable router object: useTransferViewModel's load effect depends on `router`,
// so a fresh object per render would re-run it and clobber action results.
vi.mock("next/navigation", () => {
  const router = { push, replace };
  return { useRouter: () => router, useParams: () => ({ token: "tok" }) };
});
vi.mock("@/application/providers/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  getTransferDetails: (...a: unknown[]) => getTransferDetails(...a),
  acceptTransfer: (...a: unknown[]) => acceptTransfer(...a),
  declineTransfer: (...a: unknown[]) => declineTransfer(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { useTransferViewModel } from "./useTransferViewModel";

beforeEach(() => {
  vi.clearAllMocks();
  auth = { session: { account: { status: "ACTIVE" } }, isRestoring: false };
});

describe("useTransferViewModel (hook shell)", () => {
  it("redirects an unauthenticated visitor to login with a next path", async () => {
    auth = { session: null, isRestoring: false };
    renderHook(() => useTransferViewModel());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Ftransfers%2Ftok"));
  });

  it("loads the transfer into the pending state", async () => {
    getTransferDetails.mockResolvedValue({ id: "t1" });
    const { result } = renderHook(() => useTransferViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("pending"));
    expect(result.current.transfer).toEqual({ id: "t1" });
  });

  it("shows not-found on a 404", async () => {
    getTransferDetails.mockRejectedValue(new ApiError(404, {}));
    const { result } = renderHook(() => useTransferViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("not-found"));
  });

  it("accepts the transfer and navigates to the received vehicle", async () => {
    getTransferDetails.mockResolvedValue({ id: "t1" });
    acceptTransfer.mockResolvedValue("v9");
    const { result } = renderHook(() => useTransferViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("pending"));
    await act(async () => {
      await result.current.handleAccept();
    });
    expect(result.current.loadState).toBe("accepted");
    expect(push).toHaveBeenCalledWith("/garage/v9");
  });

  it("surfaces an action error on a failed accept", async () => {
    getTransferDetails.mockResolvedValue({ id: "t1" });
    acceptTransfer.mockRejectedValue(new ApiError(409, {}));
    const { result } = renderHook(() => useTransferViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("pending"));
    await act(async () => {
      await result.current.handleAccept();
    });
    expect(result.current.actionError).toBeTruthy();
    expect(result.current.accepting).toBe(false);
  });

  it("declines the transfer", async () => {
    getTransferDetails.mockResolvedValue({ id: "t1" });
    declineTransfer.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTransferViewModel());
    await waitFor(() => expect(result.current.loadState).toBe("pending"));
    await act(async () => {
      await result.current.handleDecline();
    });
    expect(result.current.loadState).toBe("declined");
  });
});
