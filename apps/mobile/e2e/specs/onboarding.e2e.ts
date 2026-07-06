import { restartApp } from '../support/appState';
import { byTestId } from '../support/byTestId';
import { createVerifiedUser, type TestUser } from '../support/authFixtures';

// A freshly verified account is in ONBOARDING, so signing in lands on the
// onboarding wizard (routeForAccountStatus). Drives login through the UI.
async function loginToOnboarding(user: TestUser): Promise<void> {
  const loginBtn = await $(byTestId('welcome-login-btn'));
  await loginBtn.waitForDisplayed({ timeout: 45000 });
  await loginBtn.click();

  await $(byTestId('login-email-input')).waitForDisplayed({ timeout: 10000 });
  await $(byTestId('login-email-input')).setValue(user.email);
  await $(byTestId('login-password-input')).setValue(user.password);
  await $(byTestId('login-submit-btn')).click();

  await $(byTestId('onboarding-welcome-title')).waitForDisplayed({ timeout: 15000 });
}

describe('Onboarding wizard', () => {
  it('adds a first vehicle through the wizard and lands on a populated garage', async () => {
    const user = await createVerifiedUser('e2e-onboarding-add');
    await restartApp();
    await loginToOnboarding(user);

    await $(byTestId('onboarding-add-vehicle-btn')).click();
    await $(byTestId('onboarding-make-input')).waitForDisplayed({ timeout: 10000 });

    await $(byTestId('onboarding-make-input')).setValue('Honda');
    await $(byTestId('onboarding-model-input')).setValue('CB650R');
    await $(byTestId('onboarding-year-input')).setValue('2019');
    await $(byTestId('onboarding-mileage-input')).setValue('12500');

    // The action row sits in a keyboard-avoiding footer, so Continue stays tappable.
    await $(byTestId('onboarding-continue-btn')).click();

    const ready = await $(byTestId('onboarding-ready-title'));
    await ready.waitForDisplayed({ timeout: 15000 });
    await expect(ready).toBeDisplayed();

    await $(byTestId('onboarding-go-to-garage-btn')).click();

    // A populated Garage renders the add FAB; the empty state does not.
    const fab = await $(byTestId('garage-add-fab'));
    await fab.waitForDisplayed({ timeout: 15000 });
    await expect(fab).toBeDisplayed();
  });

  it('skips onboarding and lands on the empty garage', async () => {
    const user = await createVerifiedUser('e2e-onboarding-skip');
    await restartApp();
    await loginToOnboarding(user);

    await $(byTestId('onboarding-skip-btn')).click();

    const emptyTitle = await $(byTestId('garage-empty-title'));
    await emptyTitle.waitForDisplayed({ timeout: 15000 });
    await expect(emptyTitle).toBeDisplayed();
  });
});
