import { useState } from 'react';
import { router } from 'expo-router';
import { useForm, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@maintenance-log/domain';
import { ApiError, register as registerRequest } from '@maintenance-log/api-client';
import { tokenHttpClient } from '@/adapters/http/TokenHttpClient';
import { logger } from '@/adapters/logging/logger';

const REGISTER_USER_ERROR = "Couldn't create your account. Check your details and try again.";
const SERVICE_ERROR = 'We stalled. Our mechanics are on it — try again in a moment.';

export interface RegisterViewModel {
  control: Control<RegisterInput>;
  errors: FieldErrors<RegisterInput>;
  isSubmitting: boolean;
  error: string | null;
  onSignIn: () => void;
  submit: () => void;
}

export function useRegisterViewModel(): RegisterViewModel {
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(data: RegisterInput) {
    setError(null);
    try {
      await registerRequest(tokenHttpClient, data);
      router.push({ pathname: '/(auth)/verify-email', params: { email: data.email } });
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setError(REGISTER_USER_ERROR);
      } else {
        logger.error('registration request failed', { err });
        setError(SERVICE_ERROR);
      }
    }
  }

  return {
    control,
    errors,
    isSubmitting,
    error,
    onSignIn: () => router.push('/(auth)/login'),
    submit: handleSubmit(onSubmit),
  };
}
