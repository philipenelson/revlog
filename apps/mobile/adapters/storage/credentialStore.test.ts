jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { credentialStore, type StoredCredential } from './credentialStore';

const mockGet = SecureStore.getItemAsync as jest.Mock;
const mockSet = SecureStore.setItemAsync as jest.Mock;
const mockDelete = SecureStore.deleteItemAsync as jest.Mock;

const credential: StoredCredential = {
  email: 'owner@example.com',
  password: 'S3cret pass',
  userId: 'user-1',
  accountId: 'account-1',
  role: 'OWNER',
  accountStatus: 'ACTIVE',
};

beforeEach(() => jest.clearAllMocks());

describe('credentialStore.save', () => {
  it('serializes the credential to the authCredential key', async () => {
    mockSet.mockResolvedValue(undefined);
    await credentialStore.save(credential);
    expect(mockSet).toHaveBeenCalledWith('authCredential', JSON.stringify(credential));
  });
});

describe('credentialStore.get', () => {
  it('returns the parsed credential when a valid blob is stored', async () => {
    mockGet.mockResolvedValue(JSON.stringify(credential));
    expect(await credentialStore.get()).toEqual(credential);
  });

  it('returns null when nothing is stored', async () => {
    mockGet.mockResolvedValue(null);
    expect(await credentialStore.get()).toBeNull();
  });

  it('returns null when the stored value is not valid JSON', async () => {
    mockGet.mockResolvedValue('{not json');
    expect(await credentialStore.get()).toBeNull();
  });

  it('returns null when the blob is missing required fields', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ email: 'x@y.z', password: 'p' }));
    expect(await credentialStore.get()).toBeNull();
  });

  it('returns null when accountStatus is not a known value', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ ...credential, accountStatus: 'BOGUS' }));
    expect(await credentialStore.get()).toBeNull();
  });
});

describe('credentialStore.has', () => {
  it('is true when a valid credential is stored', async () => {
    mockGet.mockResolvedValue(JSON.stringify(credential));
    expect(await credentialStore.has()).toBe(true);
  });

  it('is false when nothing is stored', async () => {
    mockGet.mockResolvedValue(null);
    expect(await credentialStore.has()).toBe(false);
  });

  it('is false when the stored blob is malformed', async () => {
    mockGet.mockResolvedValue('garbage');
    expect(await credentialStore.has()).toBe(false);
  });
});

describe('credentialStore.clear', () => {
  it('deletes the authCredential key', async () => {
    mockDelete.mockResolvedValue(undefined);
    await credentialStore.clear();
    expect(mockDelete).toHaveBeenCalledWith('authCredential');
  });
});
