import type { Options } from '@wdio/types';

// Shared between iOS (wdio.ios.conf.ts) and Android (wdio.android.conf.ts).
// Each platform config spreads this and adds its own capabilities.
export const config: Omit<Options.Testrunner, 'capabilities'> = {
  runner: 'local',
  // Explicit order, not a glob: Login is the only spec that leaves a
  // persisted session (a real signed-in account in secure storage), so it
  // runs last -- nothing after it depends on starting unauthenticated.
  specs: ['./specs/welcome.e2e.ts', './specs/register.e2e.ts', './specs/login.e2e.ts'],
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
