"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@maintenance-log/domain";
import { forgotPassword } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { logger } from "@/adapters/logging/logger";
import { isUserFacingError, SERVICE_ERROR } from "@/domain/apiError";

// Where a successful request advances to: the reset screen, carrying the email
// so the OTP screen prefills it. The endpoint is enumeration-safe (always 200),
// so this runs regardless of whether the account exists (ADR 0038).
export function resetPasswordRoute(email: string): string {
  return `/reset-password?email=${encodeURIComponent(email)}`;
}

export interface ForgotPasswordViewModel {
  field: UseFormRegister<ForgotPasswordInput>;
  errors: FieldErrors<ForgotPasswordInput>;
  isSubmitting: boolean;
  formError: string | null;
  submit: () => void;
}

export function useForgotPasswordViewModel(): ForgotPasswordViewModel {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  // The endpoint is enumeration-safe (always 200), so on any resolved response
  // we advance to the reset screen carrying the email — we never reveal whether
  // the account exists (ADR 0038). Only a network/5xx failure keeps us here.
  async function onSubmit(data: ForgotPasswordInput): Promise<void> {
    setFormError(null);
    try {
      await forgotPassword(cookieHttpClient, data);
      router.push(resetPasswordRoute(data.email));
    } catch (err) {
      if (!isUserFacingError(err)) {
        logger.error("forgot-password request failed", { err });
      }
      setFormError(SERVICE_ERROR);
    }
  }

  return {
    field: register,
    errors,
    isSubmitting,
    formError,
    submit: handleSubmit(onSubmit),
  };
}
