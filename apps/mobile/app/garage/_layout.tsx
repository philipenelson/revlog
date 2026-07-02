import { Stack } from 'expo-router';

// Garage index renders its own header (RevlogMark + wordmark + offline
// indicator, matching revlog-mobile-garage.html) instead of the native
// Stack header — it's the stack root, with no back button to show. Child
// routes (Vehicle detail, Add vehicle, etc.) keep the native header. A gear
// icon -> /settings push is future work — see
// docs/specs/mobile-app/navigation.md "Garage stack header".
export default function GarageLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
