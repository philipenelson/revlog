import { Stack } from 'expo-router';
import { SplashController } from '@/application/providers/SplashController';

export default function RootLayout() {
  return (
    <SplashController>
      <Stack />
    </SplashController>
  );
}
