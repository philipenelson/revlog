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
async function openEditVehicle(user: TestUser, vehicleId: string): Promise<void> {
  await loginThroughUi(user.email, user.password);
  const card = await $(byTestId(`garage-vehicle-card-${vehicleId}`));
  await card.waitForDisplayed({ timeout: 35000 });
  await card.click();
  await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
  await $(byTestId('vehicle-detail-edit-btn')).click();
  await $(byTestId('edit-vehicle-make-input')).waitForDisplayed({ timeout: 15000 });
}

describe('Edit Vehicle screen', () => {
  beforeEach(async () => {
    await restartApp();
  });

  it('saves changes and returns to Vehicle Detail with the updated values', async () => {
    const user = await createVerifiedUser('e2e-editvehicle-happy');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 4200,
    });

    await openEditVehicle(user, vehicleId);

    await $(byTestId('edit-vehicle-nickname-input')).setValue('Widowmaker');
    await $(byTestId('edit-vehicle-mileage-input')).setValue('5000');
    await $(byTestId('edit-vehicle-save-btn')).click();

    await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
    await expect($(byTestId('vehicle-detail-name'))).toHaveText('Widowmaker', { containing: true });
    await expect($(byTestId('vehicle-detail-sub'))).toHaveText('5,000 mi', { containing: true });
  });

  // Regression test for a bug found in manual testing: Edit Vehicle's save
  // handler used router.push(`/garage/${vehicleId}`) instead of
  // router.back(). Since Edit was itself reached by pushing from Vehicle
  // Detail, pushing the same route again stacked a second Detail instance
  // on top of Edit instead of returning to the one already on the stack --
  // invisible to the eye (both instances render identically), but it meant
  // a single tap on Detail's "Garage" back-link (router.back()) popped only
  // as far as the sandwiched Edit screen, not Garage.
  it('after saving, the Garage back-link on Vehicle Detail goes to Garage, not back to Edit Vehicle', async () => {
    const user = await createVerifiedUser('e2e-editvehicle-back-stack');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 4200,
    });

    await openEditVehicle(user, vehicleId);

    await $(byTestId('edit-vehicle-mileage-input')).setValue('5000');
    await $(byTestId('edit-vehicle-save-btn')).click();
    await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });

    await $(byTestId('vehicle-detail-back')).click();

    // 25s, not the usual 15s: this Garage render follows a local write +
    // useFocusEffect refetch on the screen it's leaving, on top of Garage's
    // own first-sync cost -- more contention than a cold Garage load.
    await $(byTestId('garage-add-fab')).waitForDisplayed({ timeout: 25000 });
  });

  it('cancel discards changes and returns to Vehicle Detail unchanged', async () => {
    const user = await createVerifiedUser('e2e-editvehicle-cancel');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      make: 'Yamaha',
      model: 'MT-07',
      year: 2022,
      mileage: 1000,
    });

    await openEditVehicle(user, vehicleId);

    await $(byTestId('edit-vehicle-model-input')).setValue('Something Else');
    await $(byTestId('edit-vehicle-cancel-btn')).click();

    await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
    await expect($(byTestId('vehicle-detail-name'))).toHaveText('Yamaha MT-07', { containing: true });
  });

  it('shows an inline error and does not navigate when a required field is cleared', async () => {
    const user = await createVerifiedUser('e2e-editvehicle-invalid');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 4200,
    });

    await openEditVehicle(user, vehicleId);

    await $(byTestId('edit-vehicle-make-input')).setValue('');
    await $(byTestId('edit-vehicle-save-btn')).click();

    await $(byTestId('edit-vehicle-make-error')).waitForDisplayed({ timeout: 10000 });
    await expect($(byTestId('edit-vehicle-make-input'))).toBeDisplayed();
  });
});
