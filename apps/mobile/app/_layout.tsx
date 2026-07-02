import { Stack } from 'expo-router';
import { SplashController } from '@/application/providers/SplashController';
import { AuthProvider } from '@/application/providers/AuthProvider';
import { DatabaseProvider } from '@/application/providers/DatabaseProvider';
import { SyncProvider } from '@/application/providers/SyncProvider';

export default function RootLayout() {
  return (
    <SplashController>
      <DatabaseProvider>
        <AuthProvider>
          <SyncProvider>
            <Stack screenOptions={{
              headerTransparent: true,
              title: '',
              headerBackButtonDisplayMode: 'minimal'
            }}>
            </Stack>
          </SyncProvider>
        </AuthProvider>
      </DatabaseProvider>
    </SplashController>
  );
}