import { Stack } from 'expo-router';

// Every screen in this stack renders its own header (matching each design
// file: back link, title, action icons) instead of the native Stack header
// -- headerShown: false is the stack-wide default, not a per-screen
// override. Edit Vehicle shipped without its own entry here, inheriting the
// old default of a *visible* native header (transparent, empty title); that
// stray header sat on top of Edit Vehicle's own header and silently
// swallowed every tap on its Save/Cancel buttons -- undetectable by reading
// the code, only found via a live Appium run. headerShown: false at the
// Stack level closes that hole for every current and future screen; the
// per-screen options below are now redundant but kept for clarity. See ADR
// 0028's 2026-07-03 update.
export default function GarageLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[vehicleId]/index" options={{ headerShown: false }} />
    </Stack>
  );
}
