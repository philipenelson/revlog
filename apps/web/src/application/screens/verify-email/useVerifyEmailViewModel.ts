"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { verifyEmailSchema, type VerifyEmailInput } from "@maintenance-log/contracts";
import { verifyEmail, resendVerification } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { useAuth } from "@/application/providers/AuthProvider";
import { routeForAccountStatus } from "@/application/navigation/routeForAccountStatus";
import { logger } from "@/adapters/logging/logger";
import { mapOtpSubmitError } from "@/domain/apiError";

type ResendState = "idle" | "sending" | "sent";

export interface VerifyEmailViewModel {
  email: string | null;
  field: UseFormRegister<VerifyEmailInput>;
  errors: FieldErrors<VerifyEmailInput>;
  isSubmitting: boolean;
  isVerified: boolean;
  formError: string | null;
  resendState: ResendState;
  onResend: () => void;
  submit: () => void;
}

export function useVerifyEmailViewModel(): VerifyEmailViewModel {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const email = searchParams.get("email");

  const [formError, setFormError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [resendState, setResendState] = useState<ResendState>("idle");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    // Email is carried from registration and never edited here; the User only
    // types the code. Seeding it as a default keeps the shared schema honest.
    defaultValues: { email: email ?? "", code: "" },
  });

  async function onSubmit(data: VerifyEmailInput): Promise<void> {
    setFormError(null);
    try {
      const session = await verifyEmail(cookieHttpClient, data);
      setSession(session);
      setIsVerified(true);
      router.push(routeForAccountStatus(session.account.status));
    } catch (err) {
      const { message, shouldLog } = mapOtpSubmitError(err);
      if (shouldLog) logger.error("verify-email request failed", { err });
      setFormError(message);
    }
  }

  async function onResend(): Promise<void> {
    if (!email || resendState === "sending") return;
    setFormError(null);
    setResendState("sending");
    try {
      await resendVerification(cookieHttpClient, { email });
    } catch (err) {
      // The endpoint is enumeration-safe (always 200); reaching here means a
      // network/5xx failure. Nothing sensitive to surface — the User can retry.
      logger.error("verification resend failed", { err });
    } finally {
      setResendState("sent");
    }
  }

  return {
    email,
    field: register,
    errors,
    isSubmitting,
    isVerified,
    formError,
    resendState,
    onResend: () => void onResend(),
    submit: handleSubmit(onSubmit),
  };
}
