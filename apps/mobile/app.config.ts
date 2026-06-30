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
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'dev.revlog',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: colors.neutral[800],
    },
    package: 'dev.revlog',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        backgroundColor: colors.neutral[800],
        resizeMode: 'contain',
      },
    ],
  ],
};

export default config;
