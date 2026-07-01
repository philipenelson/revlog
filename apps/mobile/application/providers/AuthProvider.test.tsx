import { act, render, waitFor } from '@testing-library/react-native';
import type { Session } from '@maintenance-log/api-client';
import { AuthProvider, useAuth } from './AuthProvider';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';

const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;

let latestAuth: ReturnType<typeof useAuth> | undefined;

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

const fakeSession: Session = {
  accessToken: 'access-token',
  accessTokenExpiresAt: new Date().toISOString(),
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ONBOARDING' },
  refreshToken: 'refresh-token',
};

describe('AuthProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('clears any stored session on mount, even if valid tokens were present', async () => {
    // Simulates a full app restart after a previous session was persisted.
    mockGetItemAsync.mockImplementation((key: string) =>
      Promise.resolve(key === 'accessToken' ? 'stale-access-token' : 'stale-refresh-token'),
    );

    const { getAuth } = await setup();

    expect(getAuth().session).toBeNull();
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('accessToken');
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('refreshToken');
  });

  it('starts with no session when secure storage was already empty', async () => {
    mockGetItemAsync.mockResolvedValue(null);

    const { getAuth } = await setup();

    expect(getAuth().session).toBeNull();
  });

  it('setSession stores the session and persists its refresh token', async () => {
    mockGetItemAsync.mockResolvedValue(null);
    const { getAuth } = await setup();

    await act(() => {
      getAuth().setSession(fakeSession);
    });

    await waitFor(() => expect(getAuth().session).toEqual(fakeSession));
    expect(mockSetItemAsync).toHaveBeenCalledWith('accessToken', fakeSession.accessToken);
    expect(mockSetItemAsync).toHaveBeenCalledWith('refreshToken', fakeSession.refreshToken);
  });

  it('clearSession removes the session and clears secure storage', async () => {
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
  });
});
