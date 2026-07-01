import { renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useWelcomeViewModel } from './useWelcomeViewModel';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('useWelcomeViewModel', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('navigates to Register on onGetStarted', async () => {
    const { result } = await renderHook(() => useWelcomeViewModel());

    result.current.onGetStarted();

    expect(router.push).toHaveBeenCalledWith('/(auth)/register');
  });

  it('navigates to Login on onLogIn', async () => {
    const { result } = await renderHook(() => useWelcomeViewModel());

    result.current.onLogIn();

    expect(router.push).toHaveBeenCalledWith('/(auth)/login');
  });
});
