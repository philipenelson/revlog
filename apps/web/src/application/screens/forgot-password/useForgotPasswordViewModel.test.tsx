import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import { SERVICE_ERROR } from "@/domain/apiError";
import { renderViewModelForm, act } from "@/test/renderViewModel";

const { push, forgotPassword, loggerError } = vi.hoisted(() => ({
  push: vi.fn(),
  forgotPassword: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  forgotPassword: (...a: unknown[]) => forgotPassword(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useForgotPasswordViewModel } from "./useForgotPasswordViewModel";

beforeEach(() => vi.clearAllMocks());

async function submit(email: string) {
  const h = renderViewModelForm(useForgotPasswordViewModel, (vm) => vm.field, ["email"]);
  await act(async () => {
    h.setField("email", email);
  });
  await act(async () => {
    await h.getVm().submit();
  });
  return h;
}

describe("useForgotPasswordViewModel (hook shell)", () => {
  it("advances to reset-password with the encoded email on success (enumeration-safe)", async () => {
    forgotPassword.mockResolvedValue(undefined);
    await submit("rider@example.com");
    expect(forgotPassword).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/reset-password?email=rider%40example.com");
  });

  it("stays on the page with the service error and logs a 5xx/network failure", async () => {
    forgotPassword.mockRejectedValue(new ApiError(500, {}));
    const h = await submit("rider@example.com");
    expect(push).not.toHaveBeenCalled();
    expect(h.getVm().formError).toBe(SERVICE_ERROR);
    expect(loggerError).toHaveBeenCalled();
  });

  it("does not log a 4xx (nothing actionable) but still shows the service error", async () => {
    forgotPassword.mockRejectedValue(new ApiError(400, {}));
    const h = await submit("rider@example.com");
    expect(h.getVm().formError).toBe(SERVICE_ERROR);
    expect(loggerError).not.toHaveBeenCalled();
  });
});
