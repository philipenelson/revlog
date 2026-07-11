import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import { OTP_INVALID_CODE, OTP_CODE_EXPIRED, SERVICE_ERROR } from "@/domain/apiError";
import { renderViewModelForm, renderHook, act, waitFor } from "@/test/renderViewModel";

const { push, setSession, verifyEmail, resendVerification, loggerError } = vi.hoisted(() => ({
  push: vi.fn(),
  setSession: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
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
  verifyEmail: (...a: unknown[]) => verifyEmail(...a),
  resendVerification: (...a: unknown[]) => resendVerification(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useVerifyEmailViewModel } from "./useVerifyEmailViewModel";

beforeEach(() => {
  vi.clearAllMocks();
  email = "rider@example.com";
});

async function submit() {
  const h = renderViewModelForm(useVerifyEmailViewModel, (vm) => vm.field, ["code"]);
  await act(async () => {
    h.setField("code", "123456");
  });
  await act(async () => {
    await h.getVm().submit();
  });
  return h;
}

describe("useVerifyEmailViewModel (hook shell)", () => {
  it("on success sets the session, marks verified, and routes by account status", async () => {
    verifyEmail.mockResolvedValue({ account: { status: "ONBOARDING" } });
    const h = await submit();
    expect(setSession).toHaveBeenCalledWith({ account: { status: "ONBOARDING" } });
    expect(h.getVm().isVerified).toBe(true);
    expect(push).toHaveBeenCalledWith("/onboarding");
  });

  it("maps an invalid_code slug to friendly copy without logging", async () => {
    verifyEmail.mockRejectedValue(new ApiError(400, { error: "invalid_code" }));
    const h = await submit();
    expect(h.getVm().formError).toBe(OTP_INVALID_CODE);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("maps a code_expired slug to friendly copy", async () => {
    verifyEmail.mockRejectedValue(new ApiError(400, { error: "code_expired" }));
    const h = await submit();
    expect(h.getVm().formError).toBe(OTP_CODE_EXPIRED);
  });

  it("logs and shows the service error on a 5xx", async () => {
    verifyEmail.mockRejectedValue(new ApiError(500, {}));
    const h = await submit();
    expect(h.getVm().formError).toBe(SERVICE_ERROR);
    expect(loggerError).toHaveBeenCalled();
  });

  it("resend triggers resendVerification and advances resendState to sent", async () => {
    resendVerification.mockResolvedValue(undefined);
    const { result } = renderHook(() => useVerifyEmailViewModel());
    await act(async () => {
      result.current.onResend();
    });
    await waitFor(() => expect(result.current.resendState).toBe("sent"));
    expect(resendVerification).toHaveBeenCalledWith(expect.anything(), { email: "rider@example.com" });
  });

  it("resend is a no-op with no email in the query string", async () => {
    email = null;
    const { result } = renderHook(() => useVerifyEmailViewModel());
    await act(async () => {
      result.current.onResend();
    });
    expect(resendVerification).not.toHaveBeenCalled();
  });
});
