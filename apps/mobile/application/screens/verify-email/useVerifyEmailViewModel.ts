import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { verifyEmail, resendVerification } from '@maintenance-log/api-client';
import { tokenHttpClient } from '@/adapters/http/TokenHttpClient';
import { useAuth } from '@/application/providers/AuthProvider';
import { routeForAccountStatus } from '@/application/navigation/routeForAccountStatus';
import { logger } from '@/adapters/logging/logger';
import { mapOtpSubmitError } from '@/domain/apiError';
// A 6-digit numeric OTP: strip everything non-numeric and cap at 6 so paste and
// autofill can't push a malformed value past the client gate.
export function normalizeOtpCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

// The code is submittable once it is exactly 6 digits.
export function isCompleteOtpCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

type ResendState = 'idle' | 'sending' | 'sent';

export interface VerifyEmailViewModel {
  email: string;
  code: string;
  onChangeCode: (value: string) => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  error: string | null;
  resendState: ResendState;
  onResend: () => void;
  submit: () => void;
}

export function useVerifyEmailViewModel(): VerifyEmailViewModel {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const { setSession } = useAuth();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<ResendState>('idle');

  function onChangeCode(value: string): void {
    setCode(normalizeOtpCode(value));
    if (error) setError(null);
  }

  const canSubmit = isCompleteOtpCode(code) && !isSubmitting;

  // Verify is an online-only operation, never persisted locally — so it calls
  // the api-client service directly with tokenHttpClient, mirroring login and
  // register (mobile CLAUDE.md; ADR 0036). On success the returned session is
  // stored and the Owner is routed by account status (new accounts → onboarding).
  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const session = await verifyEmail(tokenHttpClient, { email, code });
      setSession(session);
      router.replace(routeForAccountStatus(session.account.status));
    } catch (err) {
      const { message, shouldLog } = mapOtpSubmitError(err);
      if (shouldLog) logger.error('verify-email request failed', { err });
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend(): Promise<void> {
    if (!email || resendState === 'sending') return;
    setError(null);
    setResendState('sending');
    try {
      await resendVerification(tokenHttpClient, { email });
    } catch (err) {
      // Resend is enumeration-safe server-side (always 200); reaching here is a
      // network/5xx failure with nothing sensitive to surface — the Owner retries.
      logger.error('verification resend failed', { err });
    } finally {
      setResendState('sent');
    }
  }

  return {
    email,
    code,
    onChangeCode,
    canSubmit,
    isSubmitting,
    error,
    resendState,
    onResend: () => void handleResend(),
    submit: () => void handleSubmit(),
  };
}
