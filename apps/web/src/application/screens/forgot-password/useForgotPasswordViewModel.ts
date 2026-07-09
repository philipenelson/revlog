"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@maintenance-log/domain";
import { ApiError, forgotPassword } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/infrastructure/http/CookieHttpClient";
import { logger } from "@/infrastructure/logging/logger";

const SERVICE_ERROR_COPY = "We stalled. Our mechanics are on it — try again in a moment.";

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
      router.push(`/reset-password?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
      if (!(err instanceof ApiError && err.status < 500)) {
        logger.error("forgot-password request failed", { err });
      }
      setFormError(SERVICE_ERROR_COPY);
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
