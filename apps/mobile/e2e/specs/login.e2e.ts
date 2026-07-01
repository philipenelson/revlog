import { restartApp } from '../support/appState';
import { createVerifiedUser, uniqueTestUser } from '../support/authFixtures';

async function goToLogin(): Promise<void> {
  const loginBtn = await $('~welcome-login-btn');
  await loginBtn.waitForDisplayed({ timeout: 20000 });
  await loginBtn.click();
  await $('~login-email-input').waitForDisplayed({ timeout: 10000 });
}

describe('Login screen', () => {
  beforeEach(async () => {
    await restartApp();
    await goToLogin();
  });

  it('signs in with a verified account and lands on the garage', async () => {
    const user = await createVerifiedUser('e2e-login-happy');

    await $('~login-email-input').setValue(user.email);
    await $('~login-password-input').setValue(user.password);
    await $('~login-submit-btn').click();

    const garagePlaceholder = await $('~placeholder-garage');
    await garagePlaceholder.waitForDisplayed({ timeout: 15000 });
    await expect(garagePlaceholder).toBeDisplayed();
  });

  it('shows a user-facing error for incorrect credentials', async () => {
    const user = uniqueTestUser('e2e-login-wrong');

    await $('~login-email-input').setValue(user.email);
    await $('~login-password-input').setValue('WrongPassword1');
    await $('~login-submit-btn').click();

    const error = await $('~login-error');
    await error.waitForDisplayed({ timeout: 15000 });
    await expect(error).toHaveText(
      "Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet.",
    );
  });

  it('navigates to Register from the footer link', async () => {
    await $('~login-register-link').click();

    const nameInput = await $('~register-name-input');
    await nameInput.waitForDisplayed({ timeout: 10000 });
    await expect(nameInput).toBeDisplayed();
  });

  it('navigates to Forgot Password from the link', async () => {
    await $('~login-forgot-password-link').click();

    const forgotPasswordPlaceholder = await $('~placeholder-forgot-password');
    await forgotPasswordPlaceholder.waitForDisplayed({ timeout: 10000 });
    await expect(forgotPasswordPlaceholder).toBeDisplayed();
  });
});
