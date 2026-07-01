import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';
import { uniqueTestUser } from '../support/authFixtures';

async function goToRegister(): Promise<void> {
  const getStarted = await $(byTestId('welcome-get-started-btn'));
  await getStarted.waitForDisplayed({ timeout: 20000 });
  await getStarted.click();
  await $(byTestId('register-name-input')).waitForDisplayed({ timeout: 10000 });
}

async function fillRegisterForm(user: { fullName: string; email: string; password: string }, confirmPassword: string) {
  await $(byTestId('register-name-input')).setValue(user.fullName);
  await $(byTestId('register-email-input')).setValue(user.email);
  await $(byTestId('register-password-input')).setValue(user.password);

  const confirmInput = await $(byTestId('register-confirm-password-input'));
  await confirmInput.setValue(confirmPassword);

  if (driver.isIOS) {
    // Dismiss the keyboard so the submit button (positioned below 4 stacked
    // fields) isn't left hidden behind it -- RN's TextInput resigns first
    // responder on the return-key newline since blurOnSubmit defaults to
    // true for non-multiline fields, and it does not append to the value.
    // Android's UiAutomator2 driver handles this differently: sending '\n'
    // there truncates the field to a single character instead of just
    // blurring it, and the submit button is already reachable there without
    // any keyboard dismissal, so this is iOS-only.
    await confirmInput.addValue('\n');
  }
}

describe('Register screen', () => {
  beforeEach(async () => {
    await restartApp();
    await goToRegister();
  });

  it('creates an account and navigates to the verify-email screen on success', async () => {
    const user = uniqueTestUser('e2e-register-happy');

    await fillRegisterForm(user, user.password);
    await $(byTestId('register-submit-btn')).click();

    const verifyEmailPlaceholder = await $(byTestId('placeholder-verify-email'));
    await verifyEmailPlaceholder.waitForDisplayed({ timeout: 15000 });
    await expect(verifyEmailPlaceholder).toBeDisplayed();
  });

  it('shows a validation error when passwords do not match', async () => {
    const user = uniqueTestUser('e2e-register-mismatch');

    await fillRegisterForm(user, 'SomethingElse1');
    await $(byTestId('register-submit-btn')).click();

    // Client-side validation blocks submission -- still on the form.
    await expect($(byTestId('register-name-input'))).toBeDisplayed();
    await expect($(byTestId('register-confirm-password-error'))).toHaveText('Passwords do not match');
  });

  it('shows a user-facing error when the email is already registered', async () => {
    const user = uniqueTestUser('e2e-register-duplicate');

    await fillRegisterForm(user, user.password);
    await $(byTestId('register-submit-btn')).click();
    await $(byTestId('placeholder-verify-email')).waitForDisplayed({ timeout: 15000 });

    await restartApp();
    await goToRegister();
    await fillRegisterForm(user, user.password);
    await $(byTestId('register-submit-btn')).click();

    const error = await $(byTestId('register-error'));
    await error.waitForDisplayed({ timeout: 15000 });
    await expect(error).toHaveText("Couldn't create your account. Check your details and try again.");
  });
});
