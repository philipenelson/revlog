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

// Seeds a Vehicle via API (New Log Entry needs an existing Vehicle to attach
// to -- UC-MOB-LOG-1's precondition), then drives the UI from login through
// Vehicle Detail's [+ Log entry] action, same pattern as vehicle-detail.e2e.ts's
// openVehicleDetail().
async function openNewLogEntry(prefix: string): Promise<void> {
  const user = await createVerifiedUser(prefix);
  const accessToken = await loginViaApi(user);
  const vehicleId = await createVehicleViaApi(accessToken, { make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });

  await loginThroughUi(user.email, user.password);
  const card = await $(byTestId(`garage-vehicle-card-${vehicleId}`));
  // Generous timeout: same first-sync cost documented in vehicle-detail.e2e.ts's openVehicleDetail().
  await card.waitForDisplayed({ timeout: 35000 });
  await card.click();

  await $(byTestId('vehicle-detail-add-log-entry-btn')).waitForDisplayed({ timeout: 15000 });
  await $(byTestId('vehicle-detail-add-log-entry-btn')).click();
  await $(byTestId('new-log-entry-title-input')).waitForDisplayed({ timeout: 15000 });
}

describe('New Log Entry screen', () => {
  beforeEach(async () => {
    await restartApp();
  });

  it('creates a minimal entry offline-locally and returns to Vehicle Detail with the entry counted', async () => {
    await openNewLogEntry('e2e-newlog-happy');

    await $(byTestId('new-log-entry-type-MAINTENANCE')).click();
    await $(byTestId('new-log-entry-title-input')).setValue('Oil & filter change');
    await $(byTestId('new-log-entry-mileage-input')).setValue('4300');
    await $(byTestId('new-log-entry-save-btn')).click();

    await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
    await expect($(byTestId('vehicle-detail-stat-entries'))).toHaveText('1', { containing: true });
  });

  it('shows inline errors and does not navigate when type, title, and mileage are left blank', async () => {
    await openNewLogEntry('e2e-newlog-invalid');

    await $(byTestId('new-log-entry-save-btn-bottom')).click();

    await $(byTestId('new-log-entry-title-error')).waitForDisplayed({ timeout: 10000 });
    await expect($(byTestId('new-log-entry-typeId-error'))).toBeDisplayed();
    await expect($(byTestId('new-log-entry-mileage-error'))).toBeDisplayed();
    await expect($(byTestId('new-log-entry-title-input'))).toBeDisplayed();
  });

  it('cancel discards the draft and returns to Vehicle Detail without creating an entry', async () => {
    await openNewLogEntry('e2e-newlog-cancel');

    await $(byTestId('new-log-entry-title-input')).setValue('Draft entry');
    await $(byTestId('new-log-entry-cancel-btn')).click();

    await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
    await expect($(byTestId('vehicle-detail-stat-entries'))).toHaveText('None', { containing: true });
  });
});
