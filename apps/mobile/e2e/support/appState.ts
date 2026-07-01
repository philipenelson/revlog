// Same identifier for both platforms (see app.config.ts's ios.bundleIdentifier
// / android.package). A cold terminate+activate is the reliable way to land
// back on a known screen (Welcome, for an unauthenticated app) between
// tests -- expo-router's own navigation state persists across `it()` blocks
// otherwise, and secure-store-backed sessions aren't cleared by app-level
// resets the way in-memory state would be.
const BUNDLE_ID = 'dev.revlog';

export async function restartApp(): Promise<void> {
  await driver.terminateApp(BUNDLE_ID);
  await driver.activateApp(BUNDLE_ID);
}
