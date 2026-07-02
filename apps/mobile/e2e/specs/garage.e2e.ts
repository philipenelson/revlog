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

describe('Garage screen', () => {
  beforeEach(async () => {
    await restartApp();
  });

  it('shows the populated garage and navigates to Vehicle Detail on card tap', async () => {
    const user = await createVerifiedUser('e2e-garage-populated');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 4200,
    });

    await loginThroughUi(user.email, user.password);

    const card = await $(byTestId(`garage-vehicle-card-${vehicleId}`));
    await card.waitForDisplayed({ timeout: 20000 });
    await expect(card).toHaveText('Blackbird', { containing: true });
    await expect(card).toHaveText('2019 Honda CB650R', { containing: true });
    // Badge text renders uppercase (design's textTransform: uppercase) --
    // ignoreCase keeps this robust to platform accessibility-tree
    // differences rather than asserting the exact case.
    await expect(card).toHaveText('0 entries', { containing: true, ignoreCase: true });

    await card.click();

    const vehicleDetailPlaceholder = await $(byTestId('placeholder-vehicle-detail'));
    await vehicleDetailPlaceholder.waitForDisplayed({ timeout: 15000 });
    await expect(vehicleDetailPlaceholder).toBeDisplayed();
  });

  it('shows the empty state for an ACTIVE account with zero vehicles, and its CTA navigates to Add Vehicle', async () => {
    // Only reachable via ACTIVE + zero vehicles: a never-onboarded account
    // is ONBOARDING and routes to /onboarding, not /garage (see
    // routeForAccountStatus.ts) -- create then delete a vehicle to reach
    // ACTIVE without leaving one behind (ADR 0015: the transition doesn't
    // revert).
    const user = await createVerifiedUser('e2e-garage-empty');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Yamaha', model: 'R1', year: 1998, mileage: 0 });
    await deleteVehicleViaApi(accessToken, vehicleId);

    await loginThroughUi(user.email, user.password);

    const emptyTitle = await $(byTestId('garage-empty-title'));
    await emptyTitle.waitForDisplayed({ timeout: 20000 });
    await expect(emptyTitle).toHaveText('Your garage is empty', { containing: true });

    const emptyCta = await $(byTestId('garage-empty-cta'));
    await expect(emptyCta).toBeDisplayed();

    await emptyCta.click();

    const addVehiclePlaceholder = await $(byTestId('placeholder-add-vehicle'));
    await addVehiclePlaceholder.waitForDisplayed({ timeout: 15000 });
    await expect(addVehiclePlaceholder).toBeDisplayed();
  });

  it('the FAB navigates to Add Vehicle', async () => {
    const user = await createVerifiedUser('e2e-garage-fab');
    const accessToken = await loginViaApi(user);
    await createVehicleViaApi(accessToken, { make: 'KTM', model: '390 Duke', year: 2021, mileage: 1800 });

    await loginThroughUi(user.email, user.password);

    const fab = await $(byTestId('garage-add-fab'));
    await fab.waitForDisplayed({ timeout: 20000 });
    await fab.click();

    const addVehiclePlaceholder = await $(byTestId('placeholder-add-vehicle'));
    await addVehiclePlaceholder.waitForDisplayed({ timeout: 15000 });
    await expect(addVehiclePlaceholder).toBeDisplayed();
  });

  // Offline-banner coverage is intentionally not automated here: this
  // WebdriverIO/Appium setup has no reliable cross-platform connectivity
  // toggle (unlike Cypress's cy.intercept on web), and simulating it by
  // killing the dev API would also break Metro's own connection to the app.
  // Verified manually instead -- see docs/specs/mobile-app/garage.md.
});
