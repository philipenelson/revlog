import type { Options } from '@wdio/types';
import { config as shared } from './wdio.shared.conf';

// Drives the already-built dev-client app by package/activity (see
// app.config.ts for the package name). Build/launch it once with
// `npx expo run:android` against a running emulator, keep Metro running,
// then point this config at that emulator.
export const config = {
  ...shared,
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': process.env.ANDROID_AVD_NAME ?? 'Pixel_7_API_35',
      'appium:appPackage': 'dev.revlog',
      'appium:appActivity': '.MainActivity',
      // true: preserve app data between sessions, including the Expo dev
      // client's cached Metro connection info -- same rationale as
      // wdio.ios.conf.ts. false here wiped that cache on every
      // restartApp() (terminateApp+activateApp), stranding the app on the
      // dev client's own server-picker screen instead of our app.
      'appium:noReset': true,
      'appium:newCommandTimeout': 240,
      'appium:autoGrantPermissions': true,
    },
  ],
} as Options.Testrunner;
