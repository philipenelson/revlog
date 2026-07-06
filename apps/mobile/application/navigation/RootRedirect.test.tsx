import { render } from '@testing-library/react-native';
import type { Session } from '@maintenance-log/api-client';
import { RootRedirect } from './RootRedirect';
import { useAuth } from '@/application/providers/AuthProvider';

const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));
jest.mock('@/application/providers/AuthProvider', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function auth(overrides: Partial<ReturnType<typeof useAuth>>): ReturnType<typeof useAuth> {
  return {
    session: null,
    isRestoring: false,
    isOffline: false,
    hasStoredCredentials: false,
    setSession: jest.fn(),
    resolveOnboarding: jest.fn(),
    clearSession: jest.fn(),
    ...overrides,
  };
}

const session: Session = {
  accessToken: 'a',
  accessTokenExpiresAt: new Date().toISOString(),
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ACTIVE' },
};

beforeEach(() => jest.clearAllMocks());

describe('RootRedirect', () => {
  it('renders nothing to redirect while restoring', async () => {
    mockUseAuth.mockReturnValue(auth({ isRestoring: true }));
    await render(<RootRedirect />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('sends a brand-new user (no session, no stored credentials) to Welcome', async () => {
    mockUseAuth.mockReturnValue(auth({ session: null, hasStoredCredentials: false }));
    await render(<RootRedirect />);
    expect(mockRedirect).toHaveBeenCalledWith('/welcome');
  });

  it('sends a returning user (no session, credentials stored) to the login screen', async () => {
    mockUseAuth.mockReturnValue(auth({ session: null, hasStoredCredentials: true }));
    await render(<RootRedirect />);
    expect(mockRedirect).toHaveBeenCalledWith('/(auth)/login');
  });

  it('routes an authenticated ACTIVE account to the garage', async () => {
    mockUseAuth.mockReturnValue(auth({ session }));
    await render(<RootRedirect />);
    expect(mockRedirect).toHaveBeenCalledWith('/garage');
  });

  it('routes an ONBOARDING account to onboarding', async () => {
    mockUseAuth.mockReturnValue(auth({ session: { ...session, account: { id: 'account-1', status: 'ONBOARDING' } } }));
    await render(<RootRedirect />);
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding');
  });
});
