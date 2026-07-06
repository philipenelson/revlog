import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordInput } from '@maintenance-log/domain';
import { ApiError, resetPassword, forgotPassword } from '@maintenance-log/api-client';
import { tokenHttpClient } from '@/infrastructure/http/TokenHttpClient';
import { useAuth } from '@/application/providers/AuthProvider';
import { routeForAccountStatus } from '@/application/navigation/routeForAccountStatus';
import { logger } from '@/infrastructure/logging/logger';

const INVALID_CODE_ERROR = "That code isn't right. Check it and try again.";
const CODE_EXPIRED_ERROR = 'That code has expired or been used up. Request a new one.';
const SERVICE_ERROR = 'We stalled. Our mechanics are on it — try again in a moment.';

type ResendState = 'idle' | 'sending' | 'sent';

export interface ResetPasswordViewModel {
  email: string;
  control: Control<ResetPasswordInput>;
  errors: FieldErrors<ResetPasswordInput>;
  isSubmitting: boolean;
  error: string | null;
  resendState: ResendState;
  onResend: () => void;
  onBackToRequest: () => void;
  submit: () => void;
}

// The server's 400s carry a machine-readable slug in the JSON body (ADR 0038);
// ApiError exposes that parsed body, not a per-slug message.
function apiErrorSlug(err: unknown): string | null {
  if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in err.body) {
    const slug = (err.body as { error: unknown }).error;
    return typeof slug === 'string' ? slug : null;
  }
  return null;
}

export function useResetPasswordViewModel(): ResetPasswordViewModel {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const { setSession } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<ResendState>('idle');

  // `email` is carried from the request screen, not a rendered field — it seeds
  // the form so resetPasswordSchema (which requires it) validates. The password
  // rules and confirm-match are enforced client-side by the shared schema.
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email, code: '', newPassword: '', confirmPassword: '' },
  });

  // Reset is an online-only op, never persisted locally — it calls the api-client
  // service directly with tokenHttpClient, like login/register/verify-email
  // (mobile CLAUDE.md; ADR 0038). On success the returned session is stored and
  // the Owner is routed by account status (auto-sign-in).
  async function onSubmit(data: ResetPasswordInput): Promise<void> {
    setError(null);
    try {
      const session = await resetPassword(tokenHttpClient, data);
      setSession(session);
      router.replace(routeForAccountStatus(session.account.status));
    } catch (err) {
      const slug = apiErrorSlug(err);
      if (slug === 'invalid_code') {
        setError(INVALID_CODE_ERROR);
      } else if (slug === 'code_expired') {
        setError(CODE_EXPIRED_ERROR);
      } else {
        if (!(err instanceof ApiError && err.status < 500)) {
          logger.error('reset-password request failed', { err });
        }
        setError(SERVICE_ERROR);
      }
    }
  }

  async function handleResend(): Promise<void> {
    if (!email || resendState === 'sending') return;
    setError(null);
    setResendState('sending');
    try {
      await forgotPassword(tokenHttpClient, { email });
    } catch (err) {
      // forgot-password is enumeration-safe server-side (always 200); reaching
      // here is a network/5xx failure with nothing sensitive to surface.
      logger.error('password reset resend failed', { err });
    } finally {
      setResendState('sent');
    }
  }

  return {
    email,
    control,
    errors,
    isSubmitting,
    error,
    resendState,
    onResend: () => void handleResend(),
    onBackToRequest: () => router.back(),
    submit: handleSubmit(onSubmit),
  };
}
