"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@maintenance-log/contracts";
import { ApiError, resetPassword, forgotPassword } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { useAuth } from "@/application/providers/AuthProvider";
import { routeForAccountStatus } from "@/application/navigation/routeForAccountStatus";
import { logger } from "@/adapters/logging/logger";

const INVALID_CODE_COPY = "That code isn't right. Check it and try again.";
const CODE_EXPIRED_COPY = "That code has expired or been used up. Request a new one below.";
const SERVICE_ERROR_COPY = "We stalled. Our mechanics are on it — try again in a moment.";

type ResendState = "idle" | "sending" | "sent";

export interface ResetPasswordViewModel {
  email: string | null;
  field: UseFormRegister<ResetPasswordInput>;
  errors: FieldErrors<ResetPasswordInput>;
  isSubmitting: boolean;
  isReset: boolean;
  formError: string | null;
  resendState: ResendState;
  onResend: () => void;
  submit: () => void;
}

// The server's 400s carry a machine-readable slug in the JSON body (ADR 0038);
// ApiError exposes that parsed body, not a per-slug message.
function apiErrorSlug(err: unknown): string | null {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "error" in err.body) {
    const slug = (err.body as { error: unknown }).error;
    return typeof slug === "string" ? slug : null;
  }
  return null;
}

export function useResetPasswordViewModel(): ResetPasswordViewModel {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const email = searchParams.get("email");

  const [formError, setFormError] = useState<string | null>(null);
  const [isReset, setIsReset] = useState(false);
  const [resendState, setResendState] = useState<ResendState>("idle");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    // Email is carried from the request screen and never edited here — the User
    // only types the code and new password. Seeding it keeps the shared schema
    // (which requires email) honest, and enforces the shared password rules.
    defaultValues: { email: email ?? "", code: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(data: ResetPasswordInput): Promise<void> {
    setFormError(null);
    try {
      const session = await resetPassword(cookieHttpClient, data);
      setSession(session);
      setIsReset(true);
      router.push(routeForAccountStatus(session.account.status));
    } catch (err) {
      const slug = apiErrorSlug(err);
      if (slug === "invalid_code") {
        setFormError(INVALID_CODE_COPY);
      } else if (slug === "code_expired") {
        setFormError(CODE_EXPIRED_COPY);
      } else {
        if (!(err instanceof ApiError && err.status < 500)) {
          logger.error("reset-password request failed", { err });
        }
        setFormError(SERVICE_ERROR_COPY);
      }
    }
  }

  async function onResend(): Promise<void> {
    if (!email || resendState === "sending") return;
    setFormError(null);
    setResendState("sending");
    try {
      await forgotPassword(cookieHttpClient, { email });
    } catch (err) {
      // forgot-password is enumeration-safe (always 200); reaching here means a
      // network/5xx failure. Nothing sensitive to surface — the User can retry.
      logger.error("password reset resend failed", { err });
    } finally {
      setResendState("sent");
    }
  }

  return {
    email,
    field: register,
    errors,
    isSubmitting,
    isReset,
    formError,
    resendState,
    onResend: () => void onResend(),
    submit: handleSubmit(onSubmit),
  };
}
