import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';
import { createLogEntryViaApi, createVehicleViaApi, createVerifiedUser, loginViaApi, type TestUser } from '../support/authFixtures';

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

// Seeds a Vehicle + Log Entry via API, then drives the UI from login through
// Vehicle Detail's log entry card -- same pattern as vehicle-detail.e2e.ts's
// openVehicleDetail(), one step further in.
async function openEditLogEntry(user: TestUser, vehicleId: string, entryId: string): Promise<void> {
  await loginThroughUi(user.email, user.password);
  const card = await $(byTestId(`garage-vehicle-card-${vehicleId}`));
  // Generous timeout: same first-sync cost documented in vehicle-detail.e2e.ts's openVehicleDetail().
  await card.waitForDisplayed({ timeout: 35000 });
  await card.click();

  await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
  await $(byTestId(`log-entry-card-${entryId}`)).click();
  await $(byTestId('edit-log-entry-title-input')).waitForDisplayed({ timeout: 15000 });
}

describe('Edit Log Entry screen', () => {
  beforeEach(async () => {
    await restartApp();
  });

  it('pre-fills the form, saves changes, and returns to Vehicle Detail with the updated title', async () => {
    const user = await createVerifiedUser('e2e-editlog-happy');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });
    const entryId = await createLogEntryViaApi(accessToken, vehicleId, {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-06-28',
      mileage: 4300,
    });

    await openEditLogEntry(user, vehicleId, entryId);

    await expect($(byTestId('edit-log-entry-title-input'))).toHaveValue('Oil & filter change');
    await expect($(byTestId(`edit-log-entry-type-MAINTENANCE`))).toBeDisplayed();

    await $(byTestId('edit-log-entry-title-input')).setValue('Oil & filter change (synthetic)');
    await $(byTestId('edit-log-entry-mileage-input')).setValue('4350');
    await $(byTestId('edit-log-entry-save-btn')).click();

    await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
    const entryTitle = await $(byTestId(`log-entry-title-${entryId}`));
    await expect(entryTitle).toHaveText('Oil & filter change (synthetic)', { containing: true });
  });

  it('shows an inline error and does not navigate when the title is cleared', async () => {
    const user = await createVerifiedUser('e2e-editlog-invalid');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });
    const entryId = await createLogEntryViaApi(accessToken, vehicleId, {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-06-28',
      mileage: 4300,
    });

    await openEditLogEntry(user, vehicleId, entryId);

    await $(byTestId('edit-log-entry-title-input')).setValue('');
    await $(byTestId('edit-log-entry-save-btn')).click();

    await $(byTestId('edit-log-entry-title-error')).waitForDisplayed({ timeout: 10000 });
    await expect($(byTestId('edit-log-entry-title-input'))).toBeDisplayed();
  });

  it('cancel discards changes and returns to Vehicle Detail unchanged', async () => {
    const user = await createVerifiedUser('e2e-editlog-cancel');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });
    const entryId = await createLogEntryViaApi(accessToken, vehicleId, {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-06-28',
      mileage: 4300,
    });

    await openEditLogEntry(user, vehicleId, entryId);

    await $(byTestId('edit-log-entry-title-input')).setValue('Something else entirely');
    await $(byTestId('edit-log-entry-cancel-btn')).click();

    await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
    const entryTitle = await $(byTestId(`log-entry-title-${entryId}`));
    await expect(entryTitle).toHaveText('Oil & filter change', { containing: true });
  });

  // UC-MOB-LOG-3.
  it('deletes the entry after confirming, returning to an empty service history', async () => {
    const user = await createVerifiedUser('e2e-editlog-delete');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });
    const entryId = await createLogEntryViaApi(accessToken, vehicleId, {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-06-28',
      mileage: 4300,
    });

    await openEditLogEntry(user, vehicleId, entryId);

    await $(byTestId('edit-log-entry-delete-btn')).click();
    await $(byTestId('edit-log-entry-delete-dialog-confirm-btn')).waitForDisplayed({ timeout: 10000 });
    // testID on the leaf Text, not the Modal container -- iOS doesn't
    // aggregate nested text for toHaveText() otherwise (same reasoning as
    // edit-vehicle.e2e.ts's delete dialog assertion).
    await expect($(byTestId('edit-log-entry-delete-dialog-title'))).toHaveText('Delete this log entry?', {
      containing: true,
    });
    await $(byTestId('edit-log-entry-delete-dialog-confirm-btn')).click();

    await $(byTestId('vehicle-detail-empty-history')).waitForDisplayed({ timeout: 15000 });
    await expect($(byTestId('vehicle-detail-stat-entries'))).toHaveText('None', { containing: true });
  });

  it('cancelling the delete confirmation keeps the entry and stays on Edit Log Entry', async () => {
    const user = await createVerifiedUser('e2e-editlog-delete-cancel');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });
    const entryId = await createLogEntryViaApi(accessToken, vehicleId, {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-06-28',
      mileage: 4300,
    });

    await openEditLogEntry(user, vehicleId, entryId);

    await $(byTestId('edit-log-entry-delete-btn')).click();
    await $(byTestId('edit-log-entry-delete-dialog-cancel-btn')).waitForDisplayed({ timeout: 10000 });
    await $(byTestId('edit-log-entry-delete-dialog-cancel-btn')).click();

    await $(byTestId('edit-log-entry-delete-dialog-cancel-btn')).waitForDisplayed({ timeout: 5000, reverse: true });
    await expect($(byTestId('edit-log-entry-title-input'))).toBeDisplayed();
  });
});
