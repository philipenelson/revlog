import type { Options } from '@wdio/types';
import { config as shared } from './wdio.shared.conf';

// Drives the already-built dev-client app by bundle ID (see app.config.ts) --
// no `app` path needed, so Appium doesn't reinstall it before every run.
// Build/launch it once with `npx expo run:ios`, keep Metro running, then
// point this config at whichever simulator that installed it on.
export const config = {
  ...shared,
  capabilities: [
    {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': process.env.IOS_SIMULATOR_NAME ?? 'iPhone 17 Pro',
      'appium:udid': process.env.IOS_SIMULATOR_UDID,
      'appium:bundleId': 'dev.revlog',
      // true: preserve app data between sessions, including the Expo dev
      // client's cached Metro connection info. A reset here means a cold
      // launch has no dev server to connect to and gets stuck on the
      // dev client's own server-picker screen instead of our app.
      'appium:noReset': true,
      'appium:newCommandTimeout': 240,
    },
  ],
} as Options.Testrunner;
