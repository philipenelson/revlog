import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';
import { createVehicleViaApi, createVerifiedUser, loginViaApi } from '../support/authFixtures';

async function goToLogin(): Promise<void> {
  const loginBtn = await $(byTestId('welcome-login-btn'));
  await loginBtn.waitForDisplayed({ timeout: 45000 });
  await loginBtn.click();
  await $(byTestId('login-email-input')).waitForDisplayed({ timeout: 10000 });
}

async function loginThroughUi(email: string, password: string): Promise<void> {
  await goToLogin();
  await $(byTestId('login-email-input')).setValue(email);
  await $(byTestId('login-password-input')).setValue(password);
  await $(byTestId('login-submit-btn')).click();
}

// Wait for the garage's first sync to finish (a vehicle card means the pull —
// including GET /users/me for the profile cache — has run) before entering
// Settings, so the Account section reads a populated cache rather than an
// empty one. Then tap the header gear.
async function openSettings(vehicleId: string): Promise<void> {
  const card = await $(byTestId(`garage-vehicle-card-${vehicleId}`));
  await card.waitForDisplayed({ timeout: 35000 });
  await $(byTestId('garage-settings-button')).click();
  await $(byTestId('settings-title')).waitForDisplayed({ timeout: 15000 });
}

describe('Settings screen', () => {
  beforeEach(async () => {
    await restartApp();
  });

  it('opens from the Garage gear and shows the account, language, legal and support sections', async () => {
    const user = await createVerifiedUser('e2e-settings');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 4200,
    });

    await loginThroughUi(user.email, user.password);
    await openSettings(vehicleId);

    // Account rows come from the offline-cached GET /users/me pull.
    await expect($(byTestId('settings-account-name'))).toHaveText('E2E Test User', { containing: true });
    await expect($(byTestId('settings-account-email'))).toHaveText(user.email, { containing: true });

    // Language defaults to English; Legal / Support / Logout are present.
    await expect($(byTestId('settings-language-value'))).toHaveText('English', { containing: true });
    await expect($(byTestId('settings-legal-terms'))).toBeDisplayed();
    await expect($(byTestId('settings-support'))).toBeDisplayed();
    await expect($(byTestId('settings-logout'))).toBeDisplayed();
  });

  it('changes the app language via the picker and reflects the new choice', async () => {
    const user = await createVerifiedUser('e2e-settings-lang');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Yamaha', model: 'MT-07', year: 2022, mileage: 900 });

    await loginThroughUi(user.email, user.password);
    await openSettings(vehicleId);

    await $(byTestId('settings-language')).click();
    const option = await $(byTestId('settings-language-option-pt-BR'));
    await option.waitForDisplayed({ timeout: 10000 });
    await option.click();

    await expect($(byTestId('settings-language-value'))).toHaveText('Português (Brasil)', { containing: true });
  });

  it('logs out via the confirmation dialog and returns to the login screen', async () => {
    const user = await createVerifiedUser('e2e-settings-logout');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'KTM', model: '390 Duke', year: 2021, mileage: 1800 });

    await loginThroughUi(user.email, user.password);
    await openSettings(vehicleId);

    await $(byTestId('settings-logout')).click();
    const confirm = await $(byTestId('settings-logout-dialog-confirm'));
    await confirm.waitForDisplayed({ timeout: 10000 });
    await confirm.click();

    // Online-required logout succeeds against the dev API and returns to
    // login. The offline-error branch isn't automated here: this Appium
    // setup has no reliable connectivity toggle (same limitation noted in
    // garage.e2e.ts for the offline banner) — it's covered by the
    // useSettingsViewModel unit test instead.
    const emailInput = await $(byTestId('login-email-input'));
    await emailInput.waitForDisplayed({ timeout: 15000 });
    await expect(emailInput).toBeDisplayed();
  });
});
