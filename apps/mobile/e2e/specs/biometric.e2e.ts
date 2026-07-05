import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';
import { createVerifiedUser, loginViaApi, createVehicleViaApi } from '../support/authFixtures';
import { enrollBiometric, unenrollBiometric } from '../support/biometric';

// Once any account has signed in on the device, its credentials survive the
// cold-start token clear (ADR 0036), so RootRedirect lands directly on the
// login screen instead of Welcome. Handle both entry points.
async function goToLoginForm(): Promise<void> {
  const emailInput = await $(byTestId('login-email-input'));
  if (await emailInput.isDisplayed().catch(() => false)) return;
  const loginBtn = await $(byTestId('welcome-login-btn'));
  await loginBtn.waitForDisplayed({ timeout: 45000 });
  await loginBtn.click();
  await emailInput.waitForDisplayed({ timeout: 10000 });
}

async function signInThroughUi(email: string, password: string): Promise<void> {
  await goToLoginForm();
  await $(byTestId('login-email-input')).setValue(email);
  await $(byTestId('login-password-input')).setValue(password);
  await $(byTestId('login-submit-btn')).click();
}

describe('Biometric unlock', () => {
  before(async function () {
    // Enrolment is an iOS-Simulator capability; skip where it isn't drivable
    // (e.g. an Android emulator without a configured fingerprint).
    try {
      await enrollBiometric();
    } catch {
      this.skip();
    }
  });

  after(async () => {
    await unenrollBiometric();
  });

  it('offers enrolment after the first login, then unlocks with biometrics on the next launch', async () => {
    // A verified account with a vehicle so it is ACTIVE and lands in the Garage.
    const user = await createVerifiedUser('e2e-biometric');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 4200,
    });

    await restartApp();
    await signInThroughUi(user.email, user.password);

    // Biometric hardware is enrolled and hasn't been offered yet → the
    // one-time enrolment prompt appears.
    const enableTitle = await $(byTestId('enable-biometrics-title'));
    await enableTitle.waitForDisplayed({ timeout: 15000 });
    await $(byTestId('enable-biometrics-enable')).click();

    // The biometry check passes (E2E seam) → enrolment completes and continues
    // to the Garage.
    const card = await $(byTestId(`garage-vehicle-card-${vehicleId}`));
    await card.waitForDisplayed({ timeout: 20000 });
    await expect(card).toBeDisplayed();

    // Relaunch: the cold start clears tokens but keeps the credentials, so the
    // login screen auto-presents biometry, which passes and lands back in the
    // Garage without retyping the password.
    await restartApp();
    const cardAfterUnlock = await $(byTestId(`garage-vehicle-card-${vehicleId}`));
    await cardAfterUnlock.waitForDisplayed({ timeout: 25000 });
    await expect(cardAfterUnlock).toBeDisplayed();
  });
});
