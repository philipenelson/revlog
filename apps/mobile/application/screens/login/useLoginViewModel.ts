import { useState } from 'react';
import { router } from 'expo-router';
import { useForm, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@maintenance-log/domain';
import { ApiError, login as loginRequest } from '@maintenance-log/api-client';
import { tokenHttpClient } from '@/infrastructure/http/TokenHttpClient';
import { useAuth } from '@/application/providers/AuthProvider';
import { routeForAccountStatus } from '@/application/navigation/routeForAccountStatus';
import { logger } from '@/infrastructure/logging/logger';

const SIGN_IN_USER_ERROR =
  "Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet.";
const SERVICE_ERROR = 'We stalled. Our mechanics are on it — try again in a moment.';

export interface LoginViewModel {
  control: Control<LoginInput>;
  errors: FieldErrors<LoginInput>;
  isSubmitting: boolean;
  error: string | null;
  onForgotPassword: () => void;
  onRegister: () => void;
  submit: () => void;
}

export function useLoginViewModel(): LoginViewModel {
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  async function onSubmit(data: LoginInput) {
    setError(null);
    try {
      const session = await loginRequest(tokenHttpClient, data);
      setSession(session);
      router.replace(routeForAccountStatus(session.account.status));
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setError(SIGN_IN_USER_ERROR);
      } else {
        logger.error('login request failed', { err });
        setError(SERVICE_ERROR);
      }
    }
  }

  return {
    control,
    errors,
    isSubmitting,
    error,
    onForgotPassword: () => router.push('/(auth)/forgot-password'),
    onRegister: () => router.push('/(auth)/register'),
    submit: handleSubmit(onSubmit),
  };
}
