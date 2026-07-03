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

  // UC-MOB-VEH-4.
  it('deletes the vehicle after confirming, returning to an empty Garage', async () => {
    const user = await createVerifiedUser('e2e-editvehicle-delete');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 4200,
    });

    await openEditVehicle(user, vehicleId);

    await $(byTestId('edit-vehicle-delete-btn')).click();
    await $(byTestId('edit-vehicle-delete-dialog-confirm-btn')).waitForDisplayed({ timeout: 10000 });
    // testID on the leaf Text, not the Modal container -- iOS doesn't
    // aggregate nested text for toHaveText() otherwise.
    await expect($(byTestId('edit-vehicle-delete-dialog-title'))).toHaveText('Blackbird', { containing: true });
    await $(byTestId('edit-vehicle-delete-dialog-confirm-btn')).click();

    // This account's only Vehicle -- an empty Garage is the deletion signal,
    // same 25s rationale as the Cancel-stack regression test above (a local
    // delete + dismissTo() lands on top of Garage's own useFocusEffect
    // refetch and first-sync cost).
    await $(byTestId('garage-empty-title')).waitForDisplayed({ timeout: 25000 });
  });

  it('cancelling the delete confirmation keeps the vehicle and stays on Edit Vehicle', async () => {
    const user = await createVerifiedUser('e2e-editvehicle-delete-cancel');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      make: 'Yamaha',
      model: 'MT-07',
      year: 2022,
      mileage: 1000,
    });

    await openEditVehicle(user, vehicleId);

    await $(byTestId('edit-vehicle-delete-btn')).click();
    await $(byTestId('edit-vehicle-delete-dialog-cancel-btn')).waitForDisplayed({ timeout: 10000 });
    await $(byTestId('edit-vehicle-delete-dialog-cancel-btn')).click();

    await $(byTestId('edit-vehicle-delete-dialog-cancel-btn')).waitForDisplayed({ timeout: 5000, reverse: true });
    await expect($(byTestId('edit-vehicle-make-input'))).toBeDisplayed();
  });
});
