import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';
import { createVerifiedUser, uniqueTestUser } from '../support/authFixtures';

async function goToLogin(): Promise<void> {
  const loginBtn = await $(byTestId('welcome-login-btn'));
  await loginBtn.waitForDisplayed({ timeout: 20000 });
  await loginBtn.click();
  await $(byTestId('login-email-input')).waitForDisplayed({ timeout: 10000 });
}

describe('Login screen', () => {
  beforeEach(async () => {
    await restartApp();
    await goToLogin();
  });

  it('shows a user-facing error for incorrect credentials', async () => {
    const user = uniqueTestUser('e2e-login-wrong');

    await $(byTestId('login-email-input')).setValue(user.email);
    await $(byTestId('login-password-input')).setValue('WrongPassword1');
    await $(byTestId('login-submit-btn')).click();

    const error = await $(byTestId('login-error'));
    await error.waitForDisplayed({ timeout: 15000 });
    await expect(error).toHaveText(
      "Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet.",
    );
  });

  it('navigates to Register from the footer link', async () => {
    await $(byTestId('login-register-link')).click();

    const nameInput = await $(byTestId('register-name-input'));
    await nameInput.waitForDisplayed({ timeout: 10000 });
    await expect(nameInput).toBeDisplayed();
  });

  it('navigates to Forgot Password from the link', async () => {
    await $(byTestId('login-forgot-password-link')).click();

    const forgotPasswordPlaceholder = await $(byTestId('placeholder-forgot-password'));
    await forgotPasswordPlaceholder.waitForDisplayed({ timeout: 10000 });
    await expect(forgotPasswordPlaceholder).toBeDisplayed();
  });

  // Runs last: a successful login persists a real session (secure-store
  // tokens), so restartApp() no longer lands on Welcome afterwards --
  // matches wdio.shared.conf.ts's spec-ordering rationale, just one level
  // down, within this describe block.
  it('signs in with a verified account and lands on onboarding', async () => {
    const user = await createVerifiedUser('e2e-login-happy');

    await $(byTestId('login-email-input')).setValue(user.email);
    await $(byTestId('login-password-input')).setValue(user.password);
    await $(byTestId('login-submit-btn')).click();

    // A freshly registered + verified account has no vehicles yet, so its
    // AccountStatus is ONBOARDING -- RootRedirect sends it to /onboarding,
    // not /garage (see application/navigation/routeForAccountStatus.ts).
    const onboardingPlaceholder = await $(byTestId('placeholder-onboarding'));
    await onboardingPlaceholder.waitForDisplayed({ timeout: 15000 });
    await expect(onboardingPlaceholder).toBeDisplayed();
  });
});
