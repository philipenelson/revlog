import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import { renderViewModelForm, renderHook, act, waitFor } from "@/test/renderViewModel";
import { SIGN_IN_USER_ERROR, REGISTER_USER_ERROR, SERVICE_ERROR } from "./login.logic";

// ── Mocks: isolate the hook shell from routing, auth context, and the network.
// vi.mock factories are hoisted above these declarations, so the fns they close
// over must be created via vi.hoisted (avoids the temporal-dead-zone error).
const { push, replace, setSession, loginRequest, registerRequest, loggerError } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  setSession: vi.fn(),
  loginRequest: vi.fn(),
  registerRequest: vi.fn(),
  loggerError: vi.fn(),
}));

let searchNext: string | null = null;
let auth: { session: unknown; isRestoring: boolean; setSession: typeof setSession };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => ({ get: (k: string) => (k === "next" ? searchNext : null) }),
}));
vi.mock("@/application/providers/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  login: (...a: unknown[]) => loginRequest(...a),
  register: (...a: unknown[]) => registerRequest(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));
vi.mock("@/adapters/logging/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useLoginViewModel } from "./useLoginViewModel";

beforeEach(() => {
  vi.clearAllMocks();
  searchNext = null;
  auth = { session: null, isRestoring: false, setSession };
});

async function submitLoginWith(email: string, password: string) {
  const h = renderViewModelForm(useLoginViewModel, (vm) => vm.login.field, ["email", "password"]);
  await act(async () => {
    h.setField("email", email);
    h.setField("password", password);
  });
  await act(async () => {
    await h.getVm().login.submit();
  });
  return h;
}

describe("useLoginViewModel (hook shell)", () => {
  it("starts on the login tab and selectTab switches tabs", () => {
    const { result } = renderHook(() => useLoginViewModel());
    expect(result.current.tab).toBe("login");
    act(() => result.current.selectTab("register"));
    expect(result.current.tab).toBe("register");
  });

  it("redirects an already-authenticated visitor by account status once restore settles", async () => {
    auth = { session: { account: { status: "ACTIVE" } }, isRestoring: false, setSession };
    renderHook(() => useLoginViewModel());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/garage"));
  });

  it("does not redirect while the session is still restoring", () => {
    auth = { session: { account: { status: "ACTIVE" } }, isRestoring: true, setSession };
    renderHook(() => useLoginViewModel());
    expect(replace).not.toHaveBeenCalled();
  });

  it("honours a safe ?next= path over the status route after login", async () => {
    searchNext = "/vehicles/42";
    loginRequest.mockResolvedValue({ account: { status: "ACTIVE" } });
    await submitLoginWith("rider@example.com", "hunter2");
    expect(setSession).toHaveBeenCalledWith({ account: { status: "ACTIVE" } });
    expect(push).toHaveBeenCalledWith("/vehicles/42");
  });

  it("routes by account status on login when there is no next path", async () => {
    loginRequest.mockResolvedValue({ account: { status: "ONBOARDING" } });
    await submitLoginWith("rider@example.com", "hunter2");
    expect(push).toHaveBeenCalledWith("/onboarding");
  });

  it("shows the friendly sign-in error on a 4xx and does not log it", async () => {
    loginRequest.mockRejectedValue(new ApiError(401, {}));
    const h = await submitLoginWith("rider@example.com", "hunter2");
    expect(h.getVm().login.error).toBe(SIGN_IN_USER_ERROR);
    expect(loggerError).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it("logs and shows the service error on a 5xx login failure", async () => {
    loginRequest.mockRejectedValue(new ApiError(500, {}));
    const h = await submitLoginWith("rider@example.com", "hunter2");
    expect(h.getVm().login.error).toBe(SERVICE_ERROR);
    expect(loggerError).toHaveBeenCalled();
  });

  it("selectTab clears a previously shown error", async () => {
    loginRequest.mockRejectedValue(new ApiError(401, {}));
    const h = await submitLoginWith("rider@example.com", "hunter2");
    expect(h.getVm().login.error).toBe(SIGN_IN_USER_ERROR);
    act(() => h.getVm().selectTab("register"));
    expect(h.getVm().login.error).toBeNull();
  });

  it("register success routes to verify-email with the encoded address", async () => {
    registerRequest.mockResolvedValue(undefined);
    const h = renderViewModelForm(
      useLoginViewModel,
      (vm) => vm.register.field,
      ["fullName", "email", "password", "confirmPassword"],
    );
    await act(async () => {
      h.setField("fullName", "Alex Rider");
      h.setField("email", "alex@example.com");
      h.setField("password", "hunter2000");
      h.setField("confirmPassword", "hunter2000");
    });
    await act(async () => {
      await h.getVm().register.submit();
    });
    expect(registerRequest).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/verify-email?email=alex%40example.com");
  });

  it("shows the friendly register error on a 4xx", async () => {
    registerRequest.mockRejectedValue(new ApiError(409, {}));
    const h = renderViewModelForm(
      useLoginViewModel,
      (vm) => vm.register.field,
      ["fullName", "email", "password", "confirmPassword"],
    );
    await act(async () => {
      h.setField("fullName", "Alex Rider");
      h.setField("email", "alex@example.com");
      h.setField("password", "hunter2000");
      h.setField("confirmPassword", "hunter2000");
    });
    await act(async () => {
      await h.getVm().register.submit();
    });
    expect(h.getVm().register.error).toBe(REGISTER_USER_ERROR);
  });
});
