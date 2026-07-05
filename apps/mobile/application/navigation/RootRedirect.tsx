import { Redirect } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { colors } from '@maintenance-log/ui-tokens';
import { useAuth } from '@/application/providers/AuthProvider';
import { routeForAccountStatus } from './routeForAccountStatus';

// The real auth gate behind app/index.tsx's redirect (kept out of app/ per
// the no-logic-in-routes rule). Resolves to /garage, /onboarding, the login
// screen, or /welcome.
export function RootRedirect() {
  const { session, isRestoring, hasStoredCredentials } = useAuth();

  // Cold-start token clear + credential probe is still in flight — render the
  // background colour instead of nothing, so there's no white flash between
  // the native splash hiding and the redirect resolving.
  if (isRestoring) return <View style={styles.container} />;

  // No session. A returning Owner (credentials survived the cold-start clear,
  // ADR 0036) goes straight to the login screen, which offers offline and
  // biometric sign-in; a brand-new user still starts at Welcome.
  if (!session) return <Redirect href={hasStoredCredentials ? '/(auth)/login' : '/welcome'} />;
  return <Redirect href={routeForAccountStatus(session.account.status)} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[800],
  },
});
