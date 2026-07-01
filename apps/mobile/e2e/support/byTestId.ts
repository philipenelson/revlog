// RN's testID surfaces differently per platform: on iOS it becomes the
// element's accessibilityIdentifier, which Appium's "~" (accessibility id)
// strategy matches directly. On Android it surfaces as the native view's
// resource-id -- NOT content-desc, which is what "~" actually matches there
// (typically the element's visible text/label instead). Confirmed empirically:
// UiAutomator2's accessibility id lookups return nothing for our testIDs,
// while `new UiSelector().resourceId(...)` finds them immediately.
export function byTestId(testId: string): string {
  return driver.isAndroid ? `android=new UiSelector().resourceId("${testId}")` : `~${testId}`;
}
