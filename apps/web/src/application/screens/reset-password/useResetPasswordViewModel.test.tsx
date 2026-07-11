import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import { OTP_INVALID_CODE, OTP_CODE_EXPIRED, SERVICE_ERROR } from "@/domain/apiError";
import { renderViewModelForm, renderHook, act, waitFor } from "@/test/renderViewModel";

const { push, setSession, resetPassword, forgotPassword, loggerError } = vi.hoisted(() => ({
  push: vi.fn(),
  setSession: vi.fn(),
  resetPassword: vi.fn(),
  forgotPassword: vi.fn(),
  loggerError: vi.fn(),
}));

let email: string | null;
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: (k: string) => (k === "email" ? email : null) }),
}));
vi.mock("@/application/providers/AuthProvider", () => ({ useAuth: () => ({ setSession }) }));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  resetPassword: (...a: unknown[]) => resetPassword(...a),
  forgotPassword: (...a: unknown[]) => forgotPassword(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useResetPasswordViewModel } from "./useResetPasswordViewModel";

beforeEach(() => {
  vi.clearAllMocks();
  email = "rider@example.com";
});

async function submit() {
  const h = renderViewModelForm(
    useResetPasswordViewModel,
    (vm) => vm.field,
    ["code", "newPassword", "confirmPassword"],
  );
  await act(async () => {
    h.setField("code", "123456");
    h.setField("newPassword", "hunter2000");
    h.setField("confirmPassword", "hunter2000");
  });
  await act(async () => {
    await h.getVm().submit();
  });
  return h;
}

describe("useResetPasswordViewModel (hook shell)", () => {
  it("exposes the email carried in the query string", () => {
    const { result } = renderHook(() => useResetPasswordViewModel());
    expect(result.current.email).toBe("rider@example.com");
  });

  it("on success sets the session, marks reset, and routes by account status", async () => {
    resetPassword.mockResolvedValue({ account: { status: "ACTIVE" } });
    const h = await submit();
    expect(setSession).toHaveBeenCalledWith({ account: { status: "ACTIVE" } });
    expect(h.getVm().isReset).toBe(true);
    expect(push).toHaveBeenCalledWith("/garage");
  });

  it("maps an invalid_code slug to friendly copy without logging", async () => {
    resetPassword.mockRejectedValue(new ApiError(400, { error: "invalid_code" }));
    const h = await submit();
    expect(h.getVm().formError).toBe(OTP_INVALID_CODE);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("maps a code_expired slug to friendly copy", async () => {
    resetPassword.mockRejectedValue(new ApiError(400, { error: "code_expired" }));
    const h = await submit();
    expect(h.getVm().formError).toBe(OTP_CODE_EXPIRED);
  });

  it("logs and shows the service error on a 5xx", async () => {
    resetPassword.mockRejectedValue(new ApiError(500, {}));
    const h = await submit();
    expect(h.getVm().formError).toBe(SERVICE_ERROR);
    expect(loggerError).toHaveBeenCalled();
  });

  it("resend triggers forgot-password and advances resendState to sent", async () => {
    forgotPassword.mockResolvedValue(undefined);
    const { result } = renderHook(() => useResetPasswordViewModel());
    expect(result.current.resendState).toBe("idle");
    await act(async () => {
      result.current.onResend();
    });
    await waitFor(() => expect(result.current.resendState).toBe("sent"));
    expect(forgotPassword).toHaveBeenCalledWith(expect.anything(), { email: "rider@example.com" });
  });

  it("resend is a no-op when there is no email in the query string", async () => {
    email = null;
    const { result } = renderHook(() => useResetPasswordViewModel());
    await act(async () => {
      result.current.onResend();
    });
    expect(forgotPassword).not.toHaveBeenCalled();
  });
});
