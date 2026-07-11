import { useState } from 'react';
import { router } from 'expo-router';
import { useForm, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@maintenance-log/contracts';
import { forgotPassword } from '@maintenance-log/api-client';
import { tokenHttpClient } from '@/adapters/http/TokenHttpClient';
import { logger } from '@/adapters/logging/logger';
import { isUserFacingError, SERVICE_ERROR } from '@/domain/apiError';

export interface ForgotPasswordViewModel {
  control: Control<ForgotPasswordInput>;
  errors: FieldErrors<ForgotPasswordInput>;
  isSubmitting: boolean;
  error: string | null;
  onBackToLogin: () => void;
  submit: () => void;
}

export function useForgotPasswordViewModel(): ForgotPasswordViewModel {
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  // Requesting a code is an online-only op, never persisted locally — so it calls
  // the api-client service directly with tokenHttpClient, like login/register
  // (mobile CLAUDE.md; ADR 0038). The endpoint is enumeration-safe (always 200),
  // so on any resolved response we advance to the reset screen carrying the email
  // — we never reveal whether the account exists. Only a network/5xx failure
  // keeps us here with a generic error.
  async function onSubmit(data: ForgotPasswordInput): Promise<void> {
    setError(null);
    try {
      await forgotPassword(tokenHttpClient, data);
      router.push({ pathname: '/(auth)/reset-password', params: { email: data.email } });
    } catch (err) {
      if (!isUserFacingError(err)) {
        logger.error('forgot-password request failed', { err });
      }
      setError(SERVICE_ERROR);
    }
  }

  return {
    control,
    errors,
    isSubmitting,
    error,
    onBackToLogin: () => router.back(),
    submit: handleSubmit(onSubmit),
  };
}
