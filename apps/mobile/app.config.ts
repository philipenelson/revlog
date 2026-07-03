import type { ExpoConfig } from 'expo/config';
// Subpath import, not the package barrel: Expo evaluates app.config.ts with
// plain Node ESM resolution (no Metro), and the barrel (src/index.ts)
// re-exports without file extensions, which Node can't resolve here.
import { colors } from '@maintenance-log/ui-tokens/colors';

// Dynamic config (not app.json) so colors can be sourced from
// @maintenance-log/ui-tokens instead of hardcoded hex — see CLAUDE.md Rule A.
const config: ExpoConfig = {
  name: 'Revlog',
  slug: 'revlog',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'revlog',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'dev.revlog',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: colors.neutral[800],
    },
    package: 'dev.revlog',
    // Expo 57 default template disables this to avoid predictive-back-gesture
    // glitches with react-native-screens' native stack navigator.
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    [
      'expo-sqlite',
      {
        // Native-level compile flag (ADR 0026) — the local DB is opened with
        // a PRAGMA key derived from expo-secure-store; see
        // infrastructure/database/openDatabase.ts. Requires `expo prebuild`
        // to take effect (not supported in Expo Go).
        useSQLCipher: true,
      },
    ],
    [
      'expo-image-picker',
      {
        // Library picker only (Add Vehicle's photo field, ADR 0027's
        // 2026-07-03 "offline-durable photo upload" update — matches the
        // web app's plain file input, not a camera-specific capability) —
        // block the camera/microphone permissions this plugin would
        // otherwise request by default.
        photosPermission: 'Allow Revlog to access your photos to add a picture of your vehicle.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: colors.neutral[800],
        resizeMode: 'contain',
        // expo-splash-screen@57.0.1's Android plugin unconditionally
        // references @drawable/splashscreen_logo in styles.xml even when no
        // image is configured (only the image-copy step is gated on `image`
        // being set, the styles.xml reference isn't) -- a 1x1 transparent
        // placeholder keeps the resource link valid without adding a visible
        // logo, matching the color-only splash we had before this SDK bump.
        image: './assets/splash-icon.png',
      },
    ],
  ],
};

export default config;
