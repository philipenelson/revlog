import * as LocalAuthentication from 'expo-local-authentication';

// Only the *authentication* prompt is stubbed under the E2E flag — that is the
// native OS modal Appium cannot reliably drive. Availability is left real so
// the rest of the E2E suite (which never enrols a biometric) sees no biometric
// and is unaffected; the biometric spec enrols one on the simulator to turn
// availability on. Read per call so Jest can toggle it; Metro inlines
// EXPO_PUBLIC_* at build time, so in the app bundle this collapses to a
// constant. See ADR 0036.
function isE2E(): boolean {
  return process.env.EXPO_PUBLIC_E2E === '1';
}

/**
 * Thin wrapper over expo-local-authentication (ADR 0036). Keeps the two facts
 * the app cares about — "can we offer biometrics?" and "did the user pass the
 * check?" — behind a small port, so viewmodels never touch the library or the
 * E2E seam directly.
 */
export const biometrics = {
  // True only when the device has biometric hardware AND the user has enrolled
  // at least one biometric — either alone means we can't actually prompt.
  async isAvailable(): Promise<boolean> {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  },

  // Presents the OS prompt; resolves true on a successful match, false on
  // cancel/failure. Never throws — a false result is the caller's cue to fall
  // back to password entry. Under the E2E flag the un-drivable prompt is
  // stubbed to success so the unlock flow is deterministic.
  async authenticate(promptMessage: string): Promise<boolean> {
    if (isE2E()) return true;
    const result = await LocalAuthentication.authenticateAsync({ promptMessage });
    return result.success;
  },
};
