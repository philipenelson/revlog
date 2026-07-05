import type { Options } from '@wdio/types';

// Shared between iOS (wdio.ios.conf.ts) and Android (wdio.android.conf.ts).
// Each platform config spreads this and adds its own capabilities.
export const config: Omit<Options.Testrunner, 'capabilities'> = {
  runner: 'local',
  // Explicit order, not a glob: Login (and now Garage, which also signs in)
  // runs last for clarity, though this is no longer strictly required --
  // AuthProvider clears expo-secure-store on every mount, so restartApp()
  // always lands back on Welcome regardless of spec order.
  specs: [
    './specs/welcome.e2e.ts',
    './specs/register.e2e.ts',
    './specs/login.e2e.ts',
    './specs/garage.e2e.ts',
    './specs/vehicle-detail.e2e.ts',
    './specs/edit-vehicle.e2e.ts',
    './specs/add-vehicle.e2e.ts',
    './specs/vehicle-transfer.e2e.ts',
    './specs/settings.e2e.ts',
  ],
  maxInstances: 1,
  logLevel: 'warn',
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: ['appium'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 90000,
  },
};
