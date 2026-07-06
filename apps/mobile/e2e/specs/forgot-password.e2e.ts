import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';
import { createVerifiedUser, findPasswordResetCode, type TestUser } from '../support/authFixtures';

// The in-app OTP reset flow (ADR 0038). Appium has no network stubbing, so these
// specs drive the real dev API + Mailpit: an already-verified account is seeded
// via the API, then the reset is completed entirely through the UI.
async function goToForgotPassword(): Promise<void> {
  const loginBtn = await $(byTestId('welcome-login-btn'));
  await loginBtn.waitForDisplayed({ timeout: 45000 });
  await loginBtn.click();

  await $(byTestId('login-forgot-password-link')).waitForDisplayed({ timeout: 10000 });
  await $(byTestId('login-forgot-password-link')).click();
  await $(byTestId('forgot-password-title')).waitForDisplayed({ timeout: 10000 });
}

// Requests a reset code for the given user and lands on the reset screen.
async function requestResetCode(user: TestUser): Promise<void> {
  const emailInput = await $(byTestId('forgot-password-email-input'));
  await emailInput.setValue(user.email);
  if (driver.isIOS) await emailInput.addValue('\n'); // dismiss the keyboard

  await $(byTestId('forgot-password-submit')).click();
  await $(byTestId('reset-password-title')).waitForDisplayed({ timeout: 15000 });
}

describe('Forgot-password (OTP reset)', () => {
  it('resets the password with a real emailed code and signs the Owner in', async () => {
    const user = await createVerifiedUser('e2e-reset-happy');
    await restartApp();
    await goToForgotPassword();
    await requestResetCode(user);

    const code = await findPasswordResetCode(user.email);
    await $(byTestId('reset-password-code-input')).setValue(code);
    await $(byTestId('reset-password-new-password-input')).setValue('NewE2ePass9');

    const confirm = await $(byTestId('reset-password-confirm-password-input'));
    await confirm.setValue('NewE2ePass9');
    if (driver.isIOS) await confirm.addValue('\n'); // dismiss the keyboard

    await $(byTestId('reset-password-submit')).click();

    // The reset auto-signs-in and routes by account status. A freshly-verified
    // account with no vehicles is in ONBOARDING, so it lands on the wizard.
    const onboarding = await $(byTestId('onboarding-welcome-title'));
    await onboarding.waitForDisplayed({ timeout: 15000 });
    await expect(onboarding).toBeDisplayed();
  });

  it('shows an inline error for a wrong code and stays on the reset screen', async () => {
    const user = await createVerifiedUser('e2e-reset-wrong');
    await restartApp();
    await goToForgotPassword();
    await requestResetCode(user); // a live reset code now exists, so a wrong guess is invalid_code

    await $(byTestId('reset-password-code-input')).setValue('000000');
    await $(byTestId('reset-password-new-password-input')).setValue('NewE2ePass9');

    const confirm = await $(byTestId('reset-password-confirm-password-input'));
    await confirm.setValue('NewE2ePass9');
    if (driver.isIOS) await confirm.addValue('\n');

    await $(byTestId('reset-password-submit')).click();

    const error = await $(byTestId('reset-password-error'));
    await error.waitForDisplayed({ timeout: 15000 });
    await expect(error).toHaveText("That code isn't right. Check it and try again.");
    await expect($(byTestId('reset-password-code-input'))).toBeDisplayed();
  });
});
