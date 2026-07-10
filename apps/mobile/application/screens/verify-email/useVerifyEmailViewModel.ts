import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError, verifyEmail, resendVerification } from '@maintenance-log/api-client';
import { tokenHttpClient } from '@/adapters/http/TokenHttpClient';
import { useAuth } from '@/application/providers/AuthProvider';
import { routeForAccountStatus } from '@/application/navigation/routeForAccountStatus';
import { logger } from '@/adapters/logging/logger';

const INVALID_CODE_ERROR = "That code isn't right. Check it and try again.";
const CODE_EXPIRED_ERROR = 'That code has expired or been used up. Request a new one.';
const SERVICE_ERROR = 'We stalled. Our mechanics are on it — try again in a moment.';

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

// The server's 400s carry a machine-readable slug in the JSON body (ADR 0037);
// ApiError exposes that parsed body, not a per-slug message.
function apiErrorSlug(err: unknown): string | null {
  if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in err.body) {
    const slug = (err.body as { error: unknown }).error;
    return typeof slug === 'string' ? slug : null;
  }
  return null;
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
    // The field is a 6-digit numeric OTP — strip anything else so paste and
    // autofill can't push a malformed value past the client gate.
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (error) setError(null);
  }

  const canSubmit = /^\d{6}$/.test(code) && !isSubmitting;

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
      const slug = apiErrorSlug(err);
      if (slug === 'invalid_code') {
        setError(INVALID_CODE_ERROR);
      } else if (slug === 'code_expired') {
        setError(CODE_EXPIRED_ERROR);
      } else {
        if (!(err instanceof ApiError && err.status < 500)) {
          logger.error('verify-email request failed', { err });
        }
        setError(SERVICE_ERROR);
      }
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
