import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';
import { createVehicleViaApi, createVerifiedUser, loginViaApi, type TestUser } from '../support/authFixtures';

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

// See openVehicleDetail in vehicle-detail.e2e.ts for the 35s rationale --
// same first-sync cost applies here.
async function openInitiateTransfer(user: TestUser, vehicleId: string): Promise<void> {
  await loginThroughUi(user.email, user.password);
  const card = await $(byTestId(`garage-vehicle-card-${vehicleId}`));
  await card.waitForDisplayed({ timeout: 35000 });
  await card.click();
  await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
  await $(byTestId('vehicle-detail-menu-btn')).click();
  await $(byTestId('vehicle-detail-menu-transfer')).waitForDisplayed({ timeout: 10000 });
  await $(byTestId('vehicle-detail-menu-transfer')).click();
  await $(byTestId('vehicle-transfer-email-input')).waitForDisplayed({ timeout: 15000 });
}

describe('Vehicle Transfer screen', () => {
  beforeEach(async () => {
    await restartApp();
  });

  // UC-MOB-TRANSFER-1's happy path.
  it('sends a transfer and returns to Vehicle Detail showing the locked state', async () => {
    const user = await createVerifiedUser('e2e-vtransfer-happy');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 4200,
    });

    await openInitiateTransfer(user, vehicleId);

    await expect($(byTestId('vehicle-transfer-vehicle-chip'))).toHaveText('Blackbird', { containing: true });
    await $(byTestId('vehicle-transfer-email-input')).setValue('buyer@example.com');
    await $(byTestId('vehicle-transfer-submit-btn')).click();

    await $(byTestId('vehicle-detail-transfer-banner')).waitForDisplayed({ timeout: 15000 });
    await expect($(byTestId('vehicle-detail-transfer-banner-body'))).toHaveText('buyer@example.com', {
      containing: true,
    });
  });

  it('shows an inline error and does not navigate for an invalid email', async () => {
    const user = await createVerifiedUser('e2e-vtransfer-invalid');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Yamaha', model: 'MT-07', year: 2022, mileage: 1000 });

    await openInitiateTransfer(user, vehicleId);

    await $(byTestId('vehicle-transfer-email-input')).setValue('not-an-email');
    await $(byTestId('vehicle-transfer-submit-btn')).click();

    await $(byTestId('vehicle-transfer-email-error')).waitForDisplayed({ timeout: 10000 });
    await expect($(byTestId('vehicle-transfer-email-input'))).toBeDisplayed();
  });

  it('the back link returns to Vehicle Detail without sending a transfer', async () => {
    const user = await createVerifiedUser('e2e-vtransfer-cancel');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Yamaha', model: 'MT-07', year: 2022, mileage: 1000 });

    await openInitiateTransfer(user, vehicleId);

    await $(byTestId('vehicle-transfer-cancel-btn')).click();

    await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
    await expect($(byTestId('vehicle-detail-stats'))).toBeDisplayed();
  });
});
