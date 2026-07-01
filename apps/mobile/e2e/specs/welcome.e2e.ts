import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';

// 45s (not the usual 10-20s) on the *first* element after restartApp():
// Android's accessibility tree can take well over 20s to materialize on a
// cold start under load (confirmed harmless -- the screen renders correctly,
// just slowly). Every wait after the app is already warm stays at 10-15s.
describe('Welcome screen', () => {
  beforeEach(async () => {
    await restartApp();
  });

  it('shows the Get Started and Log in actions', async () => {
    const getStarted = await $(byTestId('welcome-get-started-btn'));
    await getStarted.waitForDisplayed({ timeout: 45000 });

    await expect(getStarted).toBeDisplayed();
    await expect($(byTestId('welcome-login-btn'))).toBeDisplayed();
  });

  it('navigates to Register when Get Started is tapped', async () => {
    const getStarted = await $(byTestId('welcome-get-started-btn'));
    await getStarted.waitForDisplayed({ timeout: 45000 });
    await getStarted.click();

    const nameInput = await $(byTestId('register-name-input'));
    await nameInput.waitForDisplayed({ timeout: 10000 });
    await expect(nameInput).toBeDisplayed();
  });

  it('navigates to Login when Log in is tapped', async () => {
    const loginBtn = await $(byTestId('welcome-login-btn'));
    await loginBtn.waitForDisplayed({ timeout: 45000 });
    await loginBtn.click();

    const emailInput = await $(byTestId('login-email-input'));
    await emailInput.waitForDisplayed({ timeout: 10000 });
    await expect(emailInput).toBeDisplayed();
  });
});
