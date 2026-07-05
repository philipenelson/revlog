// Simulator biometric enrolment for the biometric-unlock spec (ADR 0036).
//
// The E2E seam stubs only the *authentication* result (biometrics.authenticate),
// not availability — so the rest of the suite, which never enrols a biometric,
// sees biometrics as unavailable and is unaffected. This helper enrols one on
// the simulator so biometrics.isAvailable() becomes true for the biometric spec
// alone. Enrolment is an iOS-Simulator capability (`mobile: enrollBiometric`);
// callers should skip the spec where it throws (unsupported platform/device).

export async function enrollBiometric(): Promise<void> {
  await driver.execute('mobile: enrollBiometric', { isEnabled: true });
}

export async function unenrollBiometric(): Promise<void> {
  try {
    await driver.execute('mobile: enrollBiometric', { isEnabled: false });
  } catch {
    // Best-effort cleanup — never fail the run on teardown.
  }
}
