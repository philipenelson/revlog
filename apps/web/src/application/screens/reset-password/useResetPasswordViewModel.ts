"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@maintenance-log/domain";
import { resetPassword, forgotPassword } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { useAuth } from "@/application/providers/AuthProvider";
import { routeForAccountStatus } from "@/application/navigation/routeForAccountStatus";
import { logger } from "@/adapters/logging/logger";
import { mapOtpSubmitError } from "@/domain/apiError";

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
      const { message, shouldLog } = mapOtpSubmitError(err);
      if (shouldLog) logger.error("reset-password request failed", { err });
      setFormError(message);
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
