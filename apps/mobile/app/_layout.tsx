import { Stack } from 'expo-router';
import { SplashController } from '@/application/providers/SplashController';
import { AuthProvider } from '@/application/providers/AuthProvider';
import { DatabaseProvider } from '@/application/providers/DatabaseProvider';

export default function RootLayout() {
  return (
    <SplashController>
      <DatabaseProvider>
        <AuthProvider>
          <Stack screenOptions={{
            headerTransparent: true,
            title: '',
            headerBackButtonDisplayMode: 'minimal'
          }}>
          </Stack>
        </AuthProvider>
      </DatabaseProvider>
    </SplashController>
  );
}