import { restartApp } from '../support/appState';
import { uniqueTestUser } from '../support/authFixtures';

async function goToRegister(): Promise<void> {
  const getStarted = await $('~welcome-get-started-btn');
  await getStarted.waitForDisplayed({ timeout: 20000 });
  await getStarted.click();
  await $('~register-name-input').waitForDisplayed({ timeout: 10000 });
}

async function fillRegisterForm(user: { fullName: string; email: string; password: string }, confirmPassword: string) {
  await $('~register-name-input').setValue(user.fullName);
  await $('~register-email-input').setValue(user.email);
  await $('~register-password-input').setValue(user.password);
  await $('~register-confirm-password-input').setValue(confirmPassword);
}

describe('Register screen', () => {
  beforeEach(async () => {
    await restartApp();
    await goToRegister();
  });

  it('creates an account and navigates to the verify-email screen on success', async () => {
    const user = uniqueTestUser('e2e-register-happy');

    await fillRegisterForm(user, user.password);
    await $('~register-submit-btn').click();

    const verifyEmailPlaceholder = await $('~placeholder-verify-email');
    await verifyEmailPlaceholder.waitForDisplayed({ timeout: 15000 });
    await expect(verifyEmailPlaceholder).toBeDisplayed();
  });

  it('shows a validation error when passwords do not match', async () => {
    const user = uniqueTestUser('e2e-register-mismatch');

    await fillRegisterForm(user, 'SomethingElse1');
    await $('~register-submit-btn').click();

    // Client-side validation blocks submission -- still on the form.
    await expect($('~register-name-input')).toBeDisplayed();
    await expect($('*=Passwords do not match')).toBeDisplayed();
  });

  it('shows a user-facing error when the email is already registered', async () => {
    const user = uniqueTestUser('e2e-register-duplicate');

    await fillRegisterForm(user, user.password);
    await $('~register-submit-btn').click();
    await $('~placeholder-verify-email').waitForDisplayed({ timeout: 15000 });

    await restartApp();
    await goToRegister();
    await fillRegisterForm(user, user.password);
    await $('~register-submit-btn').click();

    const error = await $('~register-error');
    await error.waitForDisplayed({ timeout: 15000 });
    await expect(error).toHaveText("Couldn't create your account. Check your details and try again.");
  });
});
