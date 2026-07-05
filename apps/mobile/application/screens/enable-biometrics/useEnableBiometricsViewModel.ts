import { useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/application/providers/AuthProvider';
import { routeForAccountStatus } from '@/application/navigation/routeForAccountStatus';
import { biometrics } from '@/infrastructure/biometrics/biometrics';
import { preferences } from '@/infrastructure/storage/preferences';

const ENABLE_PROMPT = 'Enable biometric unlock for Revlog';

export interface EnableBiometricsViewModel {
  isEnabling: boolean;
  onEnable: () => void;
  onSkip: () => void;
}

// One-time enrolment prompt shown right after the first online login when the
// device has biometric hardware and the Owner hasn't decided yet (UC-MOB-BIO-1).
// Either choice marks the Owner as prompted so it never reappears; the Settings
// toggle remains the way to change their mind later.
export function useEnableBiometricsViewModel(): EnableBiometricsViewModel {
  const { session } = useAuth();
  const [isEnabling, setIsEnabling] = useState(false);

  // Continue to wherever the just-established session belongs. Session should
  // always be present here (we arrive straight from a successful login), but
  // fall back to login if it somehow isn't.
  function proceed(): void {
    router.replace(session ? routeForAccountStatus(session.account.status) : '/(auth)/login');
  }

  async function enable(): Promise<void> {
    setIsEnabling(true);
    if (await biometrics.authenticate(ENABLE_PROMPT)) {
      await preferences.setBiometricUnlockEnabled(true);
      await preferences.setHasPromptedBiometric(true);
      proceed();
    } else {
      // Biometry cancelled/failed — stay so the Owner can retry or skip.
      setIsEnabling(false);
    }
  }

  async function skip(): Promise<void> {
    await preferences.setHasPromptedBiometric(true);
    proceed();
  }

  return {
    isEnabling,
    onEnable: () => void enable(),
    onSkip: () => void skip(),
  };
}
