# Session: Mobile — re-scaffold onto Expo SDK 57

**Date:** 2026-07-01
**Branch/worktree:** `mobile/expo-sdk-rescaffold`

---

## Goal

An in-progress attempt to hand-bump `apps/mobile` from Expo 53 straight to Expo 57 (4 SDK majors at once) had left the app "not booting cleanly" and was uncommitted on top of `6ea0284`. Rather than debug that jump or walk the SDK forward one major at a time, the goal was to re-scaffold the Expo toolchain layer from a fresh `create-expo-app@latest` and port the existing layered application code across — viable specifically because the app is early-stage and its `application/`/`domain/`/`infrastructure/` layers never touch Expo-scaffold internals. Work happened on a branch, merging to `main` only once both iOS and Android were shown to build, boot, and reach the Login screen correctly.

---

## Key decisions

| Decision | Choice | Reason |
|---|---|---|
| Re-scaffold vs. in-place/incremental upgrade | Re-scaffold | `ios/`/`android/` are `expo prebuild` output and untracked by git — nothing native to hand-migrate; see [ADR 0031](../adr/0031-expo-sdk-57-rescaffold.md) |
| Dependency versions | Ground-truthed from a throwaway `create-expo-app@latest` project, not hand-picked | Avoids guessing version numbers; matches what Expo's own tooling considers mutually compatible for the current SDK |
| `@expo/metro-runtime` | Added as an explicit direct dependency | `expo`'s bare `"*"` peer was deduping against a stale `5.0.5` resolution left in the lockfile from the old `expo-router ~5.1.11` era instead of the `^57.0.2` actually required; a `pnpm-workspace.yaml` `overrides` entry did not fix this, an explicit direct dependency did |
| `expo-splash-screen` Android drawable bug | Added a 1x1 transparent placeholder PNG as the splash `image` | `expo-splash-screen@57.0.1`'s Android plugin unconditionally references `@drawable/splashscreen_logo` in `styles.xml` even with no `image` configured (only the image-copy step was correctly gated) — AAPT2 failed resource linking without it; the placeholder renders identically to the color-only splash the app had before |
| `plugins/withFmtCxx17Fix.js` | Removed | Confirmed via a full `expo run:ios` build (no errors) that the Folly/`fmt` `consteval` workaround is no longer needed against SDK 57's pinned `fmt` pod version and Xcode 26.6 |
| `newArchEnabled` config key | Removed from `app.config.ts` | New Architecture is mandatory as of this RN/Expo generation; the current default template no longer includes the key |
| `android.predictiveBackGestureEnabled: false` | Added | Current default template sets this to avoid predictive-back-gesture glitches with `react-native-screens`' native stack navigator |
| `experiments.reactCompiler` / `experiments.typedRoutes` | Not adopted | New opt-in capabilities in the current default template, not required to reach parity on the new SDK — deferred as separate V2+ decisions |
| `src/app/` layout | Not adopted | Current default template nests `app/` under `src/`; the existing root-level `app/`/`application/`/`domain/`/`infrastructure/` layout (ADR 0023, `apps/mobile/CLAUDE.md`) is unaffected — expo-router supports both |

---

## What was built

3 commits on `mobile/expo-sdk-rescaffold`:

| Commit | SHA | Description |
|---|---|---|
| 1 | e34f7de | ADR 0031 — documents the re-scaffold decision, version table, and native-folder regeneration policy |
| 2 | cfc68ee | Bumps `expo` ~53→~57.0.1, `expo-router` ~5.1.11→~57.0.2, `react-native` 0.79.6→0.86.0, `react` 19.0.0→19.2.3, and related `expo-*`/`react-native-screens`/`react-native-safe-area-context` versions; adds `@expo/metro-runtime` direct dependency fix; drops obsolete `newArchEnabled`, adds `predictiveBackGestureEnabled: false` |
| 3 | 10e34a4 | Works around the `expo-splash-screen` Android drawable bug with a placeholder image; adds `expo-system-ui` (needed for `userInterfaceStyle: 'automatic'` to take effect on Android as of this SDK); removes the now-unneeded `withFmtCxx17Fix` plugin |

`application/`, `domain/`, `infrastructure/`, and the `app/` route shells needed **no code changes** — `pnpm --filter @maintenance-log/mobile type-check` passed clean immediately after the dependency bump, and the only import surface touching bumped packages (`expo-router`'s `Stack`/`Redirect`/`router`, `expo-secure-store`'s `SecureStore` namespace, `react-hook-form`'s `useForm`/`Controller`) needed no API changes.

---

## Verification

Both platforms were verified with real native builds and real device/emulator interaction — not just `type-check`:

- **iOS**: `expo run:ios` builds clean (0 errors) on the iPhone 17 Pro simulator (Xcode 26.6). The Appium `welcome.e2e.ts` spec passes 3/3 — including "navigates to Login when Log in is tapped," confirming Welcome → Login navigation works via real `XCUITest` automation.
- **Android**: `expo run:android` builds clean (`BUILD SUCCESSFUL`) on the `Pixel_7_API_35` emulator (API 35). The app boots to the same Welcome screen as iOS. Login-screen reachability was confirmed via a real `adb shell input tap` on the "Log in" button, landing on the actual Login screen (Email/Password fields, Sign in, Forgot password, Register link) — identical to iOS.
- The Android **Appium** `welcome.e2e.ts` run itself failed (`element ("~welcome-get-started-btn") still not displayed`) — traced to `wdio.android.conf.ts`'s `noReset: false` wiping the dev-client's cached Metro connection on `restartApp()`'s `terminateApp`+`activateApp`, unlike iOS's `noReset: true` which preserves it. This is a pre-existing gap in the Android E2E harness config (the last commit before this session already flagged Appium E2E scaffolding as WIP with the app "not yet booting cleanly"), not a regression from the SDK bump — the manual tap-through above independently confirms the app and navigation logic are correct on Android. See "Out of scope" below.

---

## Out of scope

- **Android Appium `noReset` config gap** — `wdio.android.conf.ts` needs a different session-restart strategy than `terminateApp`+`activateApp` to preserve (or re-establish) the dev-client's Metro connection between tests. Pre-existing, not caused by this change; worth its own follow-up.
- **`apps/mobile`'s `lint` script has no `eslint`/`@maintenance-log/eslint-config` devDependency** at all — pre-existing gap, unrelated to this SDK bump.
- **Real app icon / splash logo design** — this repo has never had one (confirmed: no `assets/` directory existed before this session). The 1x1 transparent placeholder added in commit 3 exists solely to satisfy the `expo-splash-screen` Android plugin's drawable requirement; it is not a design decision and should be replaced when the app gets real icon/splash assets.
- **`experiments.reactCompiler` / `experiments.typedRoutes`** — left disabled; each is a separate decision with its own review.
- **EAS Build pipeline** — already V2+ in ADR 0023; would make future SDK bumps lower-risk by building both platforms in CI.
