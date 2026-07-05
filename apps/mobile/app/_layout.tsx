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
              {/* The garage/ group renders its own nested Stack (see
                  app/garage/_layout.tsx) with the same screenOptions, and
                  owns header visibility for its own screens (hidden for its
                  index route, since that's the Garage stack's root with a
                  custom in-screen header) -- without this, the root Stack
                  also renders a header for the group as a whole, doubling
                  up with the nested one. */}
              <Stack.Screen name="garage" options={{ headerShown: false }} />
              {/* Settings renders its own header (back + title), matching
                  every other screen in the app — hide the native one. */}
              <Stack.Screen name="settings" options={{ headerShown: false }} />
            </Stack>
          </SyncProvider>
        </AuthProvider>
      </DatabaseProvider>
    </SplashController>
  );
}