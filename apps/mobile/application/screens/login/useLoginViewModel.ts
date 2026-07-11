import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useForm, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@maintenance-log/domain';
import type { Session } from '@maintenance-log/api-client';
import { useSignIn, type SignInResult } from '@/application/auth/useSignIn';
import { routeForAccountStatus } from '@/application/navigation/routeForAccountStatus';
import { biometrics } from '@/adapters/biometrics/biometrics';
import { credentialStore } from '@/adapters/storage/credentialStore';
import { preferences } from '@/adapters/storage/preferences';
import { SERVICE_ERROR } from '@/domain/apiError';

export const SIGN_IN_USER_ERROR =
  "Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet.";
export const OFFLINE_MISMATCH_ERROR =
  "You're offline, and these credentials don't match your last sign-in on this device.";

// The error message for a non-successful sign-in status, or null for the two
// success statuses (online / offline) which route instead of showing an error.
export function signInErrorMessage(status: string): string | null {
  switch (status) {
    case 'invalidCredentials':
      return SIGN_IN_USER_ERROR;
    case 'offlineUnavailable':
      return OFFLINE_MISMATCH_ERROR;
    case 'serviceError':
      return SERVICE_ERROR;
    default:
      return null;
  }
}

// After an online login, offer biometric enrolment once — only when the
// hardware is available and the Owner hasn't been prompted or already opted in
// (ADR 0036).
export function shouldOfferBiometricEnrolment(
  prompted: boolean,
  enabled: boolean,
  available: boolean,
): boolean {
  return !prompted && !enabled && available;
}

const BIOMETRIC_PROMPT = 'Unlock Revlog';

export interface LoginViewModel {
  control: Control<LoginInput>;
  errors: FieldErrors<LoginInput>;
  isSubmitting: boolean;
  error: string | null;
  // True when biometric unlock is enabled, the hardware is available, and
  // credentials are stored — the login screen shows the unlock button and the
  // viewmodel auto-prompts once on mount (ADR 0036).
  biometricAvailable: boolean;
  onBiometricUnlock: () => void;
  onForgotPassword: () => void;
  onRegister: () => void;
  submit: () => void;
}

export function useLoginViewModel(): LoginViewModel {
  const signIn = useSignIn();
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const autoUnlockAttempted = useRef(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  // After an online login, offer biometric enrolment once (UC-MOB-BIO-1) if the
  // hardware is there and the Owner hasn't been asked or already opted in;
  // otherwise go straight to their account's home. Offline logins skip the
  // prompt — enrolment is offered on the first *online* login.
  async function routeAfterOnlineLogin(session: Session): Promise<void> {
    const [prompted, enabled, available] = await Promise.all([
      preferences.getHasPromptedBiometric(),
      preferences.getBiometricUnlockEnabled(),
      biometrics.isAvailable(),
    ]);
    if (shouldOfferBiometricEnrolment(prompted, enabled, available)) {
      router.replace('/(auth)/enable-biometrics');
    } else {
      router.replace(routeForAccountStatus(session.account.status));
    }
  }

  function handleResult(result: SignInResult): void {
    if (result.status === 'online') {
      void routeAfterOnlineLogin(result.session);
      return;
    }
    if (result.status === 'offline') {
      router.replace(routeForAccountStatus(result.session.account.status));
      return;
    }
    // Remaining statuses are all failures — the pure mapping gives their copy.
    setError(signInErrorMessage(result.status));
  }

  async function onSubmit(data: LoginInput): Promise<void> {
    setError(null);
    handleResult(await signIn(data));
  }

  // Biometry check → fetch stored credentials → run them through the shared
  // sign-in path (online-first, offline fallback). A failed/cancelled prompt
  // leaves the Owner on the password form; no lockout.
  async function unlockWithBiometrics(): Promise<void> {
    setError(null);
    if (!(await biometrics.authenticate(BIOMETRIC_PROMPT))) return;
    const stored = await credentialStore.get();
    if (!stored) return;
    handleResult(await signIn({ email: stored.email, password: stored.password }));
  }

  // On mount: if biometric unlock is set up, reveal the button and auto-prompt
  // once so a returning Owner unlocks with a single tap.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await preferences.getBiometricUnlockEnabled())) return;
      const [available, hasCreds] = await Promise.all([biometrics.isAvailable(), credentialStore.has()]);
      if (cancelled || !available || !hasCreds) return;
      setBiometricAvailable(true);
      if (!autoUnlockAttempted.current) {
        autoUnlockAttempted.current = true;
        await unlockWithBiometrics();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    control,
    errors,
    isSubmitting,
    error,
    biometricAvailable,
    onBiometricUnlock: () => void unlockWithBiometrics(),
    onForgotPassword: () => router.push('/(auth)/forgot-password'),
    onRegister: () => router.push('/(auth)/register'),
    submit: handleSubmit(onSubmit),
  };
}
