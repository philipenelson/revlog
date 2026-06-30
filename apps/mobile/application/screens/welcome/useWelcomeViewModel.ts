import { useCallback } from 'react';
import { router } from 'expo-router';

export function useWelcomeViewModel() {
  const onGetStarted = useCallback(() => {
    router.push('/(auth)/register');
  }, []);

  const onLogIn = useCallback(() => {
    router.push('/(auth)/login');
  }, []);

  return { onGetStarted, onLogIn };
}
