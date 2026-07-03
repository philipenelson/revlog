import { Stack } from 'expo-router';

// Garage index and Vehicle Detail each render their own header (matching
// revlog-mobile-garage.html / revlog-mobile-vehicle-detail.html: back link,
// title, action icons) instead of the native Stack header. Garage index is
// the stack root with no back button to show; Vehicle Detail needs a title
// (the Vehicle's display name) and icon buttons the generic screenOptions
// below can't express per-route. Other child routes (Add vehicle, etc.)
// keep the native header. A gear icon -> /settings push is future work —
// see docs/specs/mobile-app/navigation.md "Garage stack header".
export default function GarageLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        title: '',
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[vehicleId]/index" options={{ headerShown: false }} />
    </Stack>
  );
}
