import { renderHook } from '@testing-library/react-native';
import { ApiError, login } from '@maintenance-log/api-client';
import type { Session } from '@maintenance-log/api-client';
import type { LoginInput } from '@maintenance-log/domain';
import { useSignIn } from './useSignIn';
import { useAuth } from '@/application/providers/AuthProvider';
import { credentialStore } from '@/infrastructure/storage/credentialStore';
import { logger } from '@/infrastructure/logging/logger';

jest.mock('@/application/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/infrastructure/http/TokenHttpClient', () => ({ tokenHttpClient: {} }));
jest.mock('@/infrastructure/storage/credentialStore', () => ({
  credentialStore: { get: jest.fn(), save: jest.fn(), has: jest.fn(), clear: jest.fn() },
}));
jest.mock('@/infrastructure/logging/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  login: jest.fn(),
}));

const mockLogin = login as jest.MockedFunction<typeof login>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGet = credentialStore.get as jest.Mock;
const mockSave = credentialStore.save as jest.Mock;

const credentials: LoginInput = { email: 'owner@example.com', password: 'S3cret pass' };

const onlineSession: Session = {
  accessToken: 'access-token',
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ACTIVE' },
  refreshToken: 'refresh-token',
};

const storedCredential = {
  email: 'owner@example.com',
  password: 'S3cret pass',
  userId: 'user-1',
  accountId: 'account-1',
  role: 'OWNER',
  accountStatus: 'ACTIVE' as const,
};

async function setup() {
  const setSession = jest.fn();
  mockUseAuth.mockReturnValue({ session: null, isRestoring: false, setSession, clearSession: jest.fn() });
  const { result } = await renderHook(() => useSignIn());
  return { signIn: result.current, setSession };
}

beforeEach(() => jest.clearAllMocks());

describe('useSignIn — online', () => {
  it('signs in, sets the session, and captures credentials on success', async () => {
    const { signIn, setSession } = await setup();
    mockLogin.mockResolvedValue(onlineSession);
    mockSave.mockResolvedValue(undefined);

    const result = await signIn(credentials);

    expect(result).toEqual({ status: 'online', session: onlineSession });
    expect(setSession).toHaveBeenCalledWith(onlineSession);
    expect(mockSave).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'S3cret pass',
      userId: 'user-1',
      accountId: 'account-1',
      role: 'OWNER',
      accountStatus: 'ACTIVE',
    });
  });

  it('still reports online (and logs) if the credential write fails', async () => {
    const { signIn, setSession } = await setup();
    mockLogin.mockResolvedValue(onlineSession);
    mockSave.mockRejectedValue(new Error('keychain locked'));

    const result = await signIn(credentials);

    expect(result.status).toBe('online');
    expect(setSession).toHaveBeenCalledWith(onlineSession);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns invalidCredentials on a 4xx and does not touch the store', async () => {
    const { signIn, setSession } = await setup();
    mockLogin.mockRejectedValue(new ApiError(401, { message: 'nope' }));

    const result = await signIn(credentials);

    expect(result).toEqual({ status: 'invalidCredentials' });
    expect(setSession).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns serviceError on a 5xx', async () => {
    const { signIn } = await setup();
    mockLogin.mockRejectedValue(new ApiError(503, {}));

    expect(await signIn(credentials)).toEqual({ status: 'serviceError' });
  });
});

describe('useSignIn — offline fallback (network error)', () => {
  it('reconstructs a token-less session when stored credentials match', async () => {
    const { signIn, setSession } = await setup();
    mockLogin.mockRejectedValue(new TypeError('Network request failed'));
    mockGet.mockResolvedValue(storedCredential);

    const result = await signIn(credentials);

    expect(result.status).toBe('offline');
    if (result.status !== 'offline') throw new Error('unreachable');
    expect(result.session.accessToken).toBe('');
    expect(result.session.user).toEqual({ id: 'user-1', accountId: 'account-1', role: 'OWNER' });
    expect(result.session.account).toEqual({ id: 'account-1', status: 'ACTIVE' });
    expect(setSession).toHaveBeenCalledWith(result.session);
  });

  it('returns offlineUnavailable when the password does not match the stored one', async () => {
    const { signIn, setSession } = await setup();
    mockLogin.mockRejectedValue(new TypeError('Network request failed'));
    mockGet.mockResolvedValue({ ...storedCredential, password: 'a different password' });

    const result = await signIn(credentials);

    expect(result).toEqual({ status: 'offlineUnavailable' });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('returns offlineUnavailable when nothing is stored', async () => {
    const { signIn } = await setup();
    mockLogin.mockRejectedValue(new TypeError('Network request failed'));
    mockGet.mockResolvedValue(null);

    expect(await signIn(credentials)).toEqual({ status: 'offlineUnavailable' });
  });
});
