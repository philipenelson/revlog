import { act, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { login } from '@maintenance-log/api-client';
import type { Session } from '@maintenance-log/api-client';
import { AuthProvider, useAuth } from './AuthProvider';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  login: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { ApiError } from '@maintenance-log/api-client';

const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;
const mockLogin = login as jest.MockedFunction<typeof login>;

let latestAuth: ReturnType<typeof useAuth> | undefined;
// Captured AppState 'change' handler so tests can simulate a foreground event.
let appStateHandler: ((state: AppStateStatus) => void) | undefined;

function Probe() {
  latestAuth = useAuth();
  return null;
}

async function setup() {
  await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(latestAuth!.isRestoring).toBe(false));
  return { getAuth: () => latestAuth! };
}

async function foregroundApp() {
  await act(async () => {
    appStateHandler?.('active');
    await Promise.resolve();
  });
}

const fakeSession: Session = {
  accessToken: 'access-token',
  accessTokenExpiresAt: new Date().toISOString(),
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ONBOARDING' },
  refreshToken: 'refresh-token',
};

const storedCredential = {
  email: 'owner@example.com',
  password: 'S3cret pass',
  userId: 'user-1',
  accountId: 'account-1',
  role: 'OWNER',
  accountStatus: 'ACTIVE',
};

const offlineSession: Session = {
  accessToken: '',
  accessTokenExpiresAt: new Date(0).toISOString(),
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ACTIVE' },
};

const upgradedSession: Session = {
  accessToken: 'fresh-access',
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ACTIVE' },
  refreshToken: 'fresh-refresh',
};

beforeEach(() => {
  appStateHandler = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
    appStateHandler = handler as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('AuthProvider — cold start & session', () => {
  it('clears any stored session on mount, even if valid tokens were present', async () => {
    mockGetItemAsync.mockImplementation((key: string) =>
      Promise.resolve(key === 'accessToken' ? 'stale-access-token' : 'stale-refresh-token'),
    );

    const { getAuth } = await setup();

    expect(getAuth().session).toBeNull();
    expect(getAuth().hasStoredCredentials).toBe(false);
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('accessToken');
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('refreshToken');
  });

  it('starts with no session when secure storage was already empty', async () => {
    mockGetItemAsync.mockResolvedValue(null);

    const { getAuth } = await setup();

    expect(getAuth().session).toBeNull();
    expect(getAuth().isOffline).toBe(false);
  });

  it('exposes hasStoredCredentials when a valid credential survived the token clear', async () => {
    mockGetItemAsync.mockImplementation((key: string) =>
      Promise.resolve(key === 'authCredential' ? JSON.stringify(storedCredential) : null),
    );

    const { getAuth } = await setup();

    expect(getAuth().hasStoredCredentials).toBe(true);
  });

  it('setSession stores the session and persists its refresh token', async () => {
    mockGetItemAsync.mockResolvedValue(null);
    const { getAuth } = await setup();

    await act(() => {
      getAuth().setSession(fakeSession);
    });

    await waitFor(() => expect(getAuth().session).toEqual(fakeSession));
    expect(getAuth().isOffline).toBe(false);
    expect(mockSetItemAsync).toHaveBeenCalledWith('accessToken', fakeSession.accessToken);
    expect(mockSetItemAsync).toHaveBeenCalledWith('refreshToken', fakeSession.refreshToken);
  });

  it('setSession with an offline (token-less) session marks isOffline and writes no tokens', async () => {
    mockGetItemAsync.mockResolvedValue(null);
    const { getAuth } = await setup();
    mockSetItemAsync.mockClear();

    await act(() => {
      getAuth().setSession(offlineSession);
    });

    await waitFor(() => expect(getAuth().session).toEqual(offlineSession));
    expect(getAuth().isOffline).toBe(true);
    expect(mockSetItemAsync).not.toHaveBeenCalledWith('accessToken', expect.anything());
    expect(mockSetItemAsync).not.toHaveBeenCalledWith('refreshToken', expect.anything());
  });

  it('clearSession removes the session, tokens, credentials and biometric flags', async () => {
    mockGetItemAsync.mockResolvedValue(null);
    const { getAuth } = await setup();
    await act(() => {
      getAuth().setSession(fakeSession);
    });
    await waitFor(() => expect(getAuth().session).toEqual(fakeSession));
    mockDeleteItemAsync.mockClear();

    await act(() => {
      getAuth().clearSession();
    });

    await waitFor(() => expect(getAuth().session).toBeNull());
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('accessToken');
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('refreshToken');
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('authCredential');
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('biometricUnlockEnabled');
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('biometricPrompted');
  });
});

describe('AuthProvider — offline→online upgrade on foreground', () => {
  beforeEach(() => {
    mockGetItemAsync.mockImplementation((key: string) =>
      Promise.resolve(key === 'authCredential' ? JSON.stringify(storedCredential) : null),
    );
  });

  it('replays stored credentials and replaces the offline session with a real one', async () => {
    mockLogin.mockResolvedValue(upgradedSession);
    const { getAuth } = await setup();
    await act(() => {
      getAuth().setSession(offlineSession);
    });
    await waitFor(() => expect(getAuth().isOffline).toBe(true));

    await foregroundApp();

    await waitFor(() => expect(getAuth().session).toEqual(upgradedSession));
    expect(getAuth().isOffline).toBe(false);
    expect(mockLogin).toHaveBeenCalledWith(expect.anything(), {
      email: 'owner@example.com',
      password: 'S3cret pass',
    });
  });

  it('clears the session and routes to login when the stored password is stale (401)', async () => {
    mockLogin.mockRejectedValue(new ApiError(401, { message: 'invalid' }));
    const { getAuth } = await setup();
    await act(() => {
      getAuth().setSession(offlineSession);
    });
    await waitFor(() => expect(getAuth().isOffline).toBe(true));

    await foregroundApp();

    await waitFor(() => expect(getAuth().session).toBeNull());
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('stays offline on a network error (no response)', async () => {
    mockLogin.mockRejectedValue(new TypeError('Network request failed'));
    const { getAuth } = await setup();
    await act(() => {
      getAuth().setSession(offlineSession);
    });
    await waitFor(() => expect(getAuth().isOffline).toBe(true));

    await foregroundApp();

    expect(getAuth().session).toEqual(offlineSession);
    expect(getAuth().isOffline).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not upgrade a normal online session', async () => {
    mockLogin.mockResolvedValue(upgradedSession);
    const { getAuth } = await setup();
    await act(() => {
      getAuth().setSession(fakeSession);
    });
    await waitFor(() => expect(getAuth().session).toEqual(fakeSession));

    await foregroundApp();

    expect(mockLogin).not.toHaveBeenCalled();
  });
});
