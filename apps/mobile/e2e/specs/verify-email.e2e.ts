import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';
import { uniqueTestUser, findVerificationCode, type TestUser } from '../support/authFixtures';

// Drives the real register flow through the UI so the app lands on the
// verify-email screen with the Owner's email, and a real code email is sent to
// Mailpit. Appium has no network stubbing, so these specs exercise the real
// dev API + Mailpit (see authFixtures).
async function registerViaUi(user: TestUser): Promise<void> {
  const getStarted = await $(byTestId('welcome-get-started-btn'));
  await getStarted.waitForDisplayed({ timeout: 45000 });
  await getStarted.click();

  await $(byTestId('register-name-input')).waitForDisplayed({ timeout: 10000 });
  await $(byTestId('register-name-input')).setValue(user.fullName);
  await $(byTestId('register-email-input')).setValue(user.email);
  await $(byTestId('register-password-input')).setValue(user.password);

  const confirm = await $(byTestId('register-confirm-password-input'));
  await confirm.setValue(user.password);
  if (driver.isIOS) await confirm.addValue('\n'); // dismiss the keyboard (see register.e2e.ts)

  await $(byTestId('register-submit-btn')).click();
  await $(byTestId('verify-email-title')).waitForDisplayed({ timeout: 15000 });
}

describe('Verify-email screen', () => {
  it('verifies a real emailed code and advances to onboarding', async () => {
    const user = uniqueTestUser('e2e-verify-happy');
    await restartApp();
    await registerViaUi(user);

    const code = await findVerificationCode(user.email);
    await $(byTestId('verify-email-code-input')).setValue(code);
    await $(byTestId('verify-email-submit')).click();

    // A brand-new account is in ONBOARDING, so verification routes onward to
    // the onboarding wizard (still a placeholder screen until that feature).
    const onboarding = await $(byTestId('placeholder-onboarding'));
    await onboarding.waitForDisplayed({ timeout: 15000 });
    await expect(onboarding).toBeDisplayed();
  });

  it('shows an inline error for a wrong code and stays on the screen', async () => {
    const user = uniqueTestUser('e2e-verify-wrong');
    await restartApp();
    await registerViaUi(user);

    await $(byTestId('verify-email-code-input')).setValue('000000');
    await $(byTestId('verify-email-submit')).click();

    const error = await $(byTestId('verify-email-error'));
    await error.waitForDisplayed({ timeout: 15000 });
    await expect(error).toHaveText("That code isn't right. Check it and try again.");
    await expect($(byTestId('verify-email-code-input'))).toBeDisplayed();
  });

  it('resends a code and confirms it was sent', async () => {
    const user = uniqueTestUser('e2e-verify-resend');
    await restartApp();
    await registerViaUi(user);

    await $(byTestId('verify-email-resend')).click();

    const sent = await $(byTestId('verify-email-resend-sent'));
    await sent.waitForDisplayed({ timeout: 15000 });
    await expect(sent).toHaveText('A new code is on its way.');
  });
});
