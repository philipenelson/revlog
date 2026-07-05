jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { preferences } from './preferences';

const mockGet = SecureStore.getItemAsync as jest.Mock;
const mockSet = SecureStore.setItemAsync as jest.Mock;

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
