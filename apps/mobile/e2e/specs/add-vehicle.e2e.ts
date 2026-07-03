import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';
import { createVehicleViaApi, createVerifiedUser, deleteVehicleViaApi, loginViaApi } from '../support/authFixtures';

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

// Only reachable via ACTIVE + zero vehicles: a never-onboarded account is
// ONBOARDING and routes to /onboarding, not /garage (see
// routeForAccountStatus.ts) -- create then delete a vehicle to reach ACTIVE
// without leaving one behind (ADR 0015: the transition doesn't revert). Same
// trick garage.e2e.ts's empty-state test uses.
async function openAddVehicleFromEmptyGarage(prefix: string): Promise<void> {
  const user = await createVerifiedUser(prefix);
  const accessToken = await loginViaApi(user);
  const vehicleId = await createVehicleViaApi(accessToken, { make: 'Yamaha', model: 'R1', year: 1998, mileage: 0 });
  await deleteVehicleViaApi(accessToken, vehicleId);

  await loginThroughUi(user.email, user.password);

  const emptyCta = await $(byTestId('garage-empty-cta'));
  // 35s, not 20s: same first-sync cost as the "populated garage" case in
  // garage.e2e.ts. This login -> first-sync -> empty-state render is also
  // where the pre-existing, environmental "garage card slow to appear"
  // flake documented in prior mobile session summaries shows up -- seen
  // here too, on whichever test happens to run first in a given worker, not
  // tied to any one test's content.
  await emptyCta.waitForDisplayed({ timeout: 35000 });
  await emptyCta.click();

  await $(byTestId('add-vehicle-make-input')).waitForDisplayed({ timeout: 15000 });
}

describe('Add Vehicle screen', () => {
  beforeEach(async () => {
    await restartApp();
  });

  it('creates the vehicle and lands on its Vehicle Detail screen', async () => {
    await openAddVehicleFromEmptyGarage('e2e-addvehicle-happy');

    await $(byTestId('add-vehicle-make-input')).setValue('Honda');
    await $(byTestId('add-vehicle-model-input')).setValue('CB650R');
    await $(byTestId('add-vehicle-year-input')).setValue('2019');
    await $(byTestId('add-vehicle-mileage-input')).setValue('4200');
    await $(byTestId('add-vehicle-nickname-input')).setValue('Blackbird');
    await $(byTestId('add-vehicle-save-btn')).click();

    await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
    await expect($(byTestId('vehicle-detail-name'))).toHaveText('Blackbird', { containing: true });
    await expect($(byTestId('vehicle-detail-sub'))).toHaveText('2019 Honda CB650R', { containing: true });
    await expect($(byTestId('vehicle-detail-sub'))).toHaveText('4,200 mi', { containing: true });
  });

  it('cancel discards the draft and returns to Garage without creating a vehicle', async () => {
    await openAddVehicleFromEmptyGarage('e2e-addvehicle-cancel');

    await $(byTestId('add-vehicle-make-input')).setValue('Ducati');
    await $(byTestId('add-vehicle-cancel-btn')).click();

    const emptyTitle = await $(byTestId('garage-empty-title'));
    await emptyTitle.waitForDisplayed({ timeout: 15000 });
    await expect(emptyTitle).toBeDisplayed();
  });

  it('shows an inline error and does not navigate when a required field is left blank', async () => {
    await openAddVehicleFromEmptyGarage('e2e-addvehicle-invalid');

    await $(byTestId('add-vehicle-model-input')).setValue('CB650R');
    await $(byTestId('add-vehicle-year-input')).setValue('2019');
    await $(byTestId('add-vehicle-mileage-input')).setValue('4200');
    // make is left blank.
    await $(byTestId('add-vehicle-save-btn')).click();

    await $(byTestId('add-vehicle-make-error')).waitForDisplayed({ timeout: 10000 });
    await expect($(byTestId('add-vehicle-make-input'))).toBeDisplayed();
  });
});
