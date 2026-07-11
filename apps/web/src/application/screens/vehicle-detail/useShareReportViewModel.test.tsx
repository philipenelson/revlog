import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@/test/renderViewModel";

const { getReportToken, createReportToken, revokeReportToken, emailReportLink } = vi.hoisted(() => ({
  getReportToken: vi.fn(),
  createReportToken: vi.fn(),
  revokeReportToken: vi.fn(),
  emailReportLink: vi.fn(),
}));

vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  getReportToken: (...a: unknown[]) => getReportToken(...a),
  createReportToken: (...a: unknown[]) => createReportToken(...a),
  revokeReportToken: (...a: unknown[]) => revokeReportToken(...a),
  emailReportLink: (...a: unknown[]) => emailReportLink(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { useShareReportViewModel } from "./useShareReportViewModel";

beforeEach(() => vi.clearAllMocks());

describe("useShareReportViewModel (hook shell)", () => {
  it("loads an existing token into the has-token state", async () => {
    getReportToken.mockResolvedValue({ shareUrl: "https://x/r/abc" });
    const { result } = renderHook(() => useShareReportViewModel("v1"));
    await waitFor(() => expect(result.current.state).toBe("has-token"));
    expect(result.current.shareUrl).toBe("https://x/r/abc");
  });

  it("shows no-token when none exists", async () => {
    getReportToken.mockResolvedValue({ shareUrl: null });
    const { result } = renderHook(() => useShareReportViewModel("v1"));
    await waitFor(() => expect(result.current.state).toBe("no-token"));
  });

  it("generates a link", async () => {
    getReportToken.mockResolvedValue({ shareUrl: null });
    createReportToken.mockResolvedValue({ shareUrl: "https://x/r/new" });
    const { result } = renderHook(() => useShareReportViewModel("v1"));
    await waitFor(() => expect(result.current.state).toBe("no-token"));
    await act(async () => {
      await result.current.generateLink();
    });
    expect(result.current.state).toBe("has-token");
    expect(result.current.shareUrl).toBe("https://x/r/new");
  });

  it("does not send an email when the input is blank", async () => {
    getReportToken.mockResolvedValue({ shareUrl: "https://x/r/abc" });
    const { result } = renderHook(() => useShareReportViewModel("v1"));
    await waitFor(() => expect(result.current.state).toBe("has-token"));
    await act(async () => {
      await result.current.sendEmail();
    });
    expect(emailReportLink).not.toHaveBeenCalled();
  });

  it("sends an email and confirms, clearing the input", async () => {
    getReportToken.mockResolvedValue({ shareUrl: "https://x/r/abc" });
    emailReportLink.mockResolvedValue(undefined);
    const { result } = renderHook(() => useShareReportViewModel("v1"));
    await waitFor(() => expect(result.current.state).toBe("has-token"));
    act(() => result.current.setEmailInput("mechanic@shop.com"));
    await act(async () => {
      await result.current.sendEmail();
    });
    expect(emailReportLink).toHaveBeenCalledWith(expect.anything(), "v1", "mechanic@shop.com");
    expect(result.current.emailSentConfirm).toBe("mechanic@shop.com");
    expect(result.current.emailInput).toBe("");
  });

  it("surfaces an email failure", async () => {
    getReportToken.mockResolvedValue({ shareUrl: "https://x/r/abc" });
    emailReportLink.mockRejectedValue(new Error("smtp"));
    const { result } = renderHook(() => useShareReportViewModel("v1"));
    await waitFor(() => expect(result.current.state).toBe("has-token"));
    act(() => result.current.setEmailInput("mechanic@shop.com"));
    await act(async () => {
      await result.current.sendEmail();
    });
    expect(result.current.emailError).toBeTruthy();
  });

  it("revokes the token back to no-token", async () => {
    getReportToken.mockResolvedValue({ shareUrl: "https://x/r/abc" });
    revokeReportToken.mockResolvedValue(undefined);
    const { result } = renderHook(() => useShareReportViewModel("v1"));
    await waitFor(() => expect(result.current.state).toBe("has-token"));
    await act(async () => {
      await result.current.revoke();
    });
    expect(result.current.state).toBe("no-token");
    expect(result.current.shareUrl).toBeNull();
  });
});
