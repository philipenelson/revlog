import { Stack } from 'expo-router';
import { SplashController } from '@/application/providers/SplashController';
import { AuthProvider } from '@/application/providers/AuthProvider';

export default function RootLayout() {
  return (
    <SplashController>
      <AuthProvider>
        <Stack />
      </AuthProvider>
    </SplashController>
  );
}
