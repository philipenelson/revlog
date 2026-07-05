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
// same first-sync cost applies here. Lands on the no-token state (a freshly
// created vehicle has no active token, so GET returns 200 {shareUrl: null}).
async function openShareReport(user: TestUser, vehicleId: string): Promise<void> {
  await loginThroughUi(user.email, user.password);
  const card = await $(byTestId(`garage-vehicle-card-${vehicleId}`));
  await card.waitForDisplayed({ timeout: 35000 });
  await card.click();
  await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
  await $(byTestId('vehicle-detail-share-report-btn')).click();
  await $(byTestId('mechanic-printout-generate-btn')).waitForDisplayed({ timeout: 20000 });
}

describe('Mechanic Printout screen', () => {
  beforeEach(async () => {
    await restartApp();
  });

  // UC-MOB-PRINT-1 + UC-MOB-PRINT-3 happy path: generate a link, see the URL
  // and Share action, then revoke back to the generate state. Tapping Share
  // itself is intentionally not exercised -- it hands off to the OS share
  // sheet (a system view outside the app), which Appium can't reliably drive.
  it('generates a share link, then revokes it back to the generate state', async () => {
    const user = await createVerifiedUser('e2e-print-happy');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, {
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 4200,
    });

    await openShareReport(user, vehicleId);

    await $(byTestId('mechanic-printout-generate-btn')).click();

    // has-token state: the URL card and Share action appear.
    await $(byTestId('mechanic-printout-url')).waitForDisplayed({ timeout: 20000 });
    await expect($(byTestId('mechanic-printout-url'))).toHaveText('/report/', { containing: true });
    await expect($(byTestId('mechanic-printout-share-btn'))).toBeDisplayed();

    // Revoke behind the confirmation dialog.
    await $(byTestId('mechanic-printout-revoke-btn')).click();
    await $(byTestId('mechanic-printout-revoke-dialog-title')).waitForDisplayed({ timeout: 10000 });
    await $(byTestId('mechanic-printout-revoke-confirm-btn')).click();

    // Back to the generate state.
    await $(byTestId('mechanic-printout-generate-btn')).waitForDisplayed({ timeout: 20000 });
  });

  it('keeps the link when the revoke dialog is dismissed', async () => {
    const user = await createVerifiedUser('e2e-print-keep');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Yamaha', model: 'MT-07', year: 2022, mileage: 1000 });

    await openShareReport(user, vehicleId);

    await $(byTestId('mechanic-printout-generate-btn')).click();
    await $(byTestId('mechanic-printout-url')).waitForDisplayed({ timeout: 20000 });

    await $(byTestId('mechanic-printout-revoke-btn')).click();
    await $(byTestId('mechanic-printout-revoke-dismiss-btn')).waitForDisplayed({ timeout: 10000 });
    await $(byTestId('mechanic-printout-revoke-dismiss-btn')).click();

    // Still on the has-token state -- the link survives a dismissed dialog.
    await expect($(byTestId('mechanic-printout-url'))).toBeDisplayed();
  });

  it('the back link returns to Vehicle Detail', async () => {
    const user = await createVerifiedUser('e2e-print-back');
    const accessToken = await loginViaApi(user);
    const vehicleId = await createVehicleViaApi(accessToken, { make: 'Yamaha', model: 'MT-07', year: 2022, mileage: 1000 });

    await openShareReport(user, vehicleId);

    await $(byTestId('mechanic-printout-back-btn')).click();

    await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
    await expect($(byTestId('vehicle-detail-stats'))).toBeDisplayed();
  });
});
