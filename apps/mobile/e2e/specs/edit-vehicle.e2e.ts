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

// The Save/Cancel buttons live in the header, outside the form's
// keyboardShouldPersistTaps ScrollView (unlike Register/Login, whose submit
// button is a ScrollView child). Two things were confirmed by live
// page-source dumps while chasing why save/cancel taps never registered:
//
// 1. edit-vehicle-cancel-btn (and by the same structure, edit-vehicle-save-
//    btn) reports visible="false" via WDA's accessibility snapshot at all
//    times -- keyboard open or fully dismissed, before or after the tap.
//    This is a static property of this element, not a keyboard-occlusion
//    effect. element.click() -- even called twice -- respects that
//    "hittable" flag and silently no-ops.
// 2. browser.hideKeyboard() also fails here: WDA has no dismiss strategy it
//    recognizes for this custom RN keyboard-avoiding layout ("Did not know
//    how to dismiss the keyboard").
//
// The fix that actually works: tap the keyboard's own Return key (a real,
// visible element) to blur the focused field first, then tap the header
// button by raw screen coordinates via `mobile: tap`, which bypasses the
// element-hittable check `.click()` respects.
async function dismissKeyboardViaReturnKey(): Promise<void> {
  const returnKey = await $('~Return');
  if (await returnKey.isExisting()) {
    await returnKey.click();
  }
}

async function forceTap(testId: string): Promise<void> {
  const el = await $(byTestId(testId));
  const location = await el.getLocation();
  const size = await el.getSize();
  await browser.execute('mobile: tap', {
    x: location.x + size.width / 2,
    y: location.y + size.height / 2,
  });
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
    await dismissKeyboardViaReturnKey();
    await forceTap('edit-vehicle-save-btn');

    await $(byTestId('vehicle-detail-name')).waitForDisplayed({ timeout: 15000 });
    await expect($(byTestId('vehicle-detail-name'))).toHaveText('Widowmaker', { containing: true });
    await expect($(byTestId('vehicle-detail-sub'))).toHaveText('5,000 mi', { containing: true });
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
    await dismissKeyboardViaReturnKey();
    await forceTap('edit-vehicle-cancel-btn');

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
    await dismissKeyboardViaReturnKey();
    await forceTap('edit-vehicle-save-btn');

    await $(byTestId('edit-vehicle-make-error')).waitForDisplayed({ timeout: 10000 });
    await expect($(byTestId('edit-vehicle-make-input'))).toBeDisplayed();
  });
});
