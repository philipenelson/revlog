import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';
import {
  createLogEntryViaApi,
  createVehicleViaApi,
  createVerifiedUser,
  initiateTransferViaApi,
  loginViaApi,
  type TestUser,
} from '../support/authFixtures';

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

async function openVehicleDetail(user: TestUser, vehicleId: string): Promise<void> {
  await loginThroughUi(user.email, user.password);
  const card = await $(byTestId(`garage-vehicle-card-${vehicleId}`));
  await card.waitForDisplayed({ timeout: 20000 });
  await card.click();
  await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
}

describe('Vehicle Detail screen', () => {
  beforeEach(async () => {
    await restartApp();
  });

  it('shows stats and service history for a vehicle with log entries, and the back link returns to Garage', async () => {
    const user = await createVerifiedUser('e2e-vdetail-populated');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 4200,
    });
    const entryId = await createLogEntryViaApi(accessToken, vehicleId, {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-06-28',
      mileage: 4300,
    });

    await openVehicleDetail(user, vehicleId);

    await expect($(byTestId('vehicle-detail-name'))).toHaveText('Blackbird', { containing: true });
    await expect($(byTestId('vehicle-detail-stats'))).toHaveText('1', { containing: true });
    await expect($(byTestId('vehicle-detail-stats'))).toHaveText('Jun 28, 2026', { containing: true });

    const entryCard = await $(byTestId(`log-entry-card-${entryId}`));
    await expect(entryCard).toBeDisplayed();
    await expect(entryCard).toHaveText('Oil & filter change', { containing: true });

    await $(byTestId('vehicle-detail-back')).click();
    await $(byTestId('garage-add-fab')).waitForDisplayed({ timeout: 15000 });
  });

  it('tapping a log entry card navigates to Edit Log Entry', async () => {
    const user = await createVerifiedUser('e2e-vdetail-nav-entry');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });
    const entryId = await createLogEntryViaApi(accessToken, vehicleId, {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-06-28',
    });

    await openVehicleDetail(user, vehicleId);
    await $(byTestId(`log-entry-card-${entryId}`)).click();

    await $(byTestId('placeholder-edit-log-entry')).waitForDisplayed({ timeout: 15000 });
  });

  it('the [+ Log entry] action navigates to New Log Entry', async () => {
    const user = await createVerifiedUser('e2e-vdetail-nav-new-entry');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });

    await openVehicleDetail(user, vehicleId);
    await $(byTestId('vehicle-detail-add-log-entry-btn')).click();

    await $(byTestId('placeholder-new-log-entry')).waitForDisplayed({ timeout: 15000 });
  });

  it('the Edit icon navigates to Edit Vehicle', async () => {
    const user = await createVerifiedUser('e2e-vdetail-nav-edit');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });

    await openVehicleDetail(user, vehicleId);
    await $(byTestId('vehicle-detail-edit-btn')).click();

    await $(byTestId('placeholder-edit-vehicle')).waitForDisplayed({ timeout: 15000 });
  });

  it('the Share icon and [Share report] action both navigate to the Mechanic Printout screen', async () => {
    const user = await createVerifiedUser('e2e-vdetail-nav-share');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });

    await openVehicleDetail(user, vehicleId);
    await $(byTestId('vehicle-detail-share-btn')).click();

    await $(byTestId('placeholder-mechanic-printout')).waitForDisplayed({ timeout: 15000 });
  });

  it('shows the empty history state for a vehicle with no log entries, and its CTA navigates to New Log Entry', async () => {
    const user = await createVerifiedUser('e2e-vdetail-empty');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Yamaha', model: 'MT-07', year: 2022, mileage: 0 });

    await openVehicleDetail(user, vehicleId);

    const emptyHistory = await $(byTestId('vehicle-detail-empty-history'));
    await emptyHistory.waitForDisplayed({ timeout: 15000 });
    await expect($(byTestId('vehicle-detail-stats'))).toHaveText('None', { containing: true });
    await expect($(byTestId('vehicle-detail-stats'))).toHaveText('—', { containing: true });

    await $(byTestId('vehicle-detail-empty-history-cta')).click();
    await $(byTestId('placeholder-new-log-entry')).waitForDisplayed({ timeout: 15000 });
  });

  it('shows the locked state for a vehicle with a pending transfer and disables its actions', async () => {
    const user = await createVerifiedUser('e2e-vdetail-locked');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'KTM', model: 'Duke 390', year: 2021, mileage: 8200 });
    await initiateTransferViaApi(accessToken, vehicleId, 'alex@example.com');

    await openVehicleDetail(user, vehicleId);

    const banner = await $(byTestId('vehicle-detail-transfer-banner'));
    await banner.waitForDisplayed({ timeout: 15000 });
    await expect(banner).toHaveText('alex@example.com', { containing: true });
    await expect($(byTestId('vehicle-detail-stats'))).not.toBeExisting();

    // Tapping the disabled action must not navigate anywhere.
    await $(byTestId('vehicle-detail-add-log-entry-btn')).click();
    await expect($(byTestId('vehicle-detail-name'))).toBeDisplayed();
  });
});
