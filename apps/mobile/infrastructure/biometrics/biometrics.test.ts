jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

import * as LocalAuthentication from 'expo-local-authentication';
import { biometrics } from './biometrics';

const mockHasHardware = LocalAuthentication.hasHardwareAsync as jest.Mock;
const mockIsEnrolled = LocalAuthentication.isEnrolledAsync as jest.Mock;
const mockAuthenticate = LocalAuthentication.authenticateAsync as jest.Mock;

const originalE2E = process.env.EXPO_PUBLIC_E2E;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.EXPO_PUBLIC_E2E;
});

afterAll(() => {
  if (originalE2E === undefined) delete process.env.EXPO_PUBLIC_E2E;
  else process.env.EXPO_PUBLIC_E2E = originalE2E;
});

describe('biometrics.isAvailable', () => {
  it('is true when hardware exists and a biometric is enrolled', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    expect(await biometrics.isAvailable()).toBe(true);
  });

  it('is false when there is no hardware', async () => {
    mockHasHardware.mockResolvedValue(false);
    mockIsEnrolled.mockResolvedValue(true);
    expect(await biometrics.isAvailable()).toBe(false);
  });

  it('is false when no biometric is enrolled', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(false);
    expect(await biometrics.isAvailable()).toBe(false);
  });
});

describe('biometrics.authenticate', () => {
  it('returns true on a successful match', async () => {
    mockAuthenticate.mockResolvedValue({ success: true });
    expect(await biometrics.authenticate('Unlock Revlog')).toBe(true);
    expect(mockAuthenticate).toHaveBeenCalledWith({ promptMessage: 'Unlock Revlog' });
  });

  it('returns false on cancel/failure', async () => {
    mockAuthenticate.mockResolvedValue({ success: false, error: 'user_cancel' });
    expect(await biometrics.authenticate('Unlock Revlog')).toBe(false);
  });
});

describe('E2E seam (EXPO_PUBLIC_E2E=1)', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_E2E = '1';
  });

  it('still resolves availability from the real capability (so the rest of the suite is unaffected)', async () => {
    mockHasHardware.mockResolvedValue(false);
    mockIsEnrolled.mockResolvedValue(false);
    expect(await biometrics.isAvailable()).toBe(false);
    expect(mockHasHardware).toHaveBeenCalled();
  });

  it('authenticates successfully without presenting the native prompt', async () => {
    expect(await biometrics.authenticate('Unlock Revlog')).toBe(true);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});
