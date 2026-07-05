jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { preferences } from './preferences';

const mockGet = SecureStore.getItemAsync as jest.Mock;
const mockSet = SecureStore.setItemAsync as jest.Mock;
const mockDelete = SecureStore.deleteItemAsync as jest.Mock;

describe('preferences.getLocale', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the stored locale when it is a supported one', async () => {
    mockGet.mockResolvedValue('pt-BR');
    expect(await preferences.getLocale()).toBe('pt-BR');
  });

  it('falls back to the default (en) when nothing is stored', async () => {
    mockGet.mockResolvedValue(null);
    expect(await preferences.getLocale()).toBe('en');
  });

  it('falls back to the default (en) when the stored value is not a supported locale', async () => {
    mockGet.mockResolvedValue('xx-YY');
    expect(await preferences.getLocale()).toBe('en');
  });
});

describe('preferences.setLocale', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the chosen locale to secure store', async () => {
    mockSet.mockResolvedValue(undefined);
    await preferences.setLocale('es');
    expect(mockSet).toHaveBeenCalledWith('appLocale', 'es');
  });
});

describe('preferences biometric flags', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads biometric-enabled as true only for the string "true"', async () => {
    mockGet.mockResolvedValue('true');
    expect(await preferences.getBiometricUnlockEnabled()).toBe(true);
    mockGet.mockResolvedValue('false');
    expect(await preferences.getBiometricUnlockEnabled()).toBe(false);
    mockGet.mockResolvedValue(null);
    expect(await preferences.getBiometricUnlockEnabled()).toBe(false);
  });

  it('writes the biometric-enabled flag as a string', async () => {
    mockSet.mockResolvedValue(undefined);
    await preferences.setBiometricUnlockEnabled(true);
    expect(mockSet).toHaveBeenCalledWith('biometricUnlockEnabled', 'true');
    await preferences.setBiometricUnlockEnabled(false);
    expect(mockSet).toHaveBeenCalledWith('biometricUnlockEnabled', 'false');
  });

  it('reads and writes the has-prompted flag', async () => {
    mockGet.mockResolvedValue(null);
    expect(await preferences.getHasPromptedBiometric()).toBe(false);
    mockGet.mockResolvedValue('true');
    expect(await preferences.getHasPromptedBiometric()).toBe(true);

    mockSet.mockResolvedValue(undefined);
    await preferences.setHasPromptedBiometric(true);
    expect(mockSet).toHaveBeenCalledWith('biometricPrompted', 'true');
  });

  it('clearBiometric deletes both flag keys', async () => {
    mockDelete.mockResolvedValue(undefined);
    await preferences.clearBiometric();
    expect(mockDelete).toHaveBeenCalledWith('biometricUnlockEnabled');
    expect(mockDelete).toHaveBeenCalledWith('biometricPrompted');
  });
});
