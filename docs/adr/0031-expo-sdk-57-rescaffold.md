# Mobile: re-scaffold onto Expo SDK 57 instead of an in-place upgrade

## Context

ADR 0023 pinned the mobile app to Expo 53 / expo-router v5 / RN 0.79.6 / React 19.0.0. An attempt to jump straight to Expo 57 / RN 0.86 / React 19.2.3 was made by hand-editing `apps/mobile/package.json` version strings in place. That attempt:

- Triggered pnpm's `minimumReleaseAge` freshness check for ~18 packages, auto-appending them to `pnpm-workspace.yaml`'s `minimumReleaseAgeExclude` (see "Supply-chain guardrail" below for how that mechanism actually works).
- Left the app "not booting cleanly" (see commit `6ea0284`), consistent with what was on disk: `ios/Pods` contained a mixed set of native artifacts (`hermes-ios-0.79.6-*` alongside `reactnative-core-0.86.0-*`) — a half-upgraded native project from a partial `pod install` against a 4-SDK-major version jump.

That attempt was discarded (it was uncommitted, so a plain `git restore` returned the tree to `6ea0284`).

Two facts make an in-place, file-by-file dependency bump the wrong tool here:

- `apps/mobile/ios/` and `apps/mobile/android/` are **not git-tracked** (confirmed via `git ls-files`) — they are `expo prebuild` output regenerated from `app.config.ts` + installed packages. There is no native code to hand-migrate between SDK versions; the correct operation is to delete and regenerate them, not patch them in place.
- The app is genuinely early-stage — per `docs/milestones/v1.md`, only the Welcome/Login/Register screens and the auth gate exist; most of the Mobile section of the V1 milestone is still unchecked. The porting surface is small.

## Decision

**Re-scaffold the toolchain layer of `apps/mobile` from a fresh `npx create-expo-app@latest`, and port the existing layered code across, rather than upgrading dependencies in place or walking the SDK forward one major at a time.**

This is viable specifically because the layered architecture from ADR 0023 already isolates the porting surface: `application/`, `domain/`, `infrastructure/`, and the thin `app/` route shells depend only on public package APIs (`react`, `react-native`, `expo-router`, `expo-secure-store`, `react-hook-form`) — never on Expo-scaffold internals. Only a small, well-defined set of toolchain files needs rebuilding: `package.json`, `app.config.ts`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `plugins/`.

This ADR supersedes only the runtime/version pin recorded in ADR 0023 (Expo 53 → Expo 57). The layered-architecture, routing pattern, offline-first rules, and bundle identifier decisions in ADR 0023 are unchanged.

### Versions (ground truth from `npx create-expo-app@latest`, not hand-picked)

A throwaway reference project was generated with `create-expo-app@latest` and diffed against the existing `apps/mobile` files, rather than guessing compatible version numbers by hand. Final versions adopted, matching the reference scaffold's own pinning convention (tilde for `expo-*` packages, exact for `react`/`react-native`/`react-native-screens`):

| package | old (Expo 53) | new (Expo 57) |
|---|---|---|
| expo | ~53.0.0 | ~57.0.1 |
| expo-router | ~5.1.11 | ~57.0.2 |
| expo-linking | ~7.1.7 | ~57.0.1 |
| expo-secure-store | ~14.2.4 | ~57.0.0 |
| expo-splash-screen | ^0.30.10 | ~57.0.1 |
| expo-status-bar | ~2.2.0 | ~57.0.0 |
| react | 19.0.0 | 19.2.3 |
| react-native | 0.79.6 | 0.86.0 |
| react-native-safe-area-context | 5.4.0 | ~5.7.0 |
| react-native-screens | ~4.11.1 | 4.25.2 |
| @types/react | ~19.0.0 | ~19.2.2 |
| typescript | ^5.8.3 | ~6.0.3 |

`react-hook-form`, the WebdriverIO/Appium E2E stack, and other dependencies unrelated to the Expo SDK itself are left untouched — this is an SDK re-scaffold, not a general dependency refresh. The one exception is `appium-xcuitest-driver`, bumped to `^11.17.1` because the E2E verification gate for this change runs against the iOS 26.5 / Xcode 26.6 simulator already installed on the build machine, which the previously-pinned `^11.16.3` predates.

**`@expo/metro-runtime` needed an explicit direct dependency.** `expo@57.0.1` declares it as a bare `"*"` optional peer, and `pnpm install` deduped that peer against a stale `5.0.5` resolution already sitting in `pnpm-lock.yaml` from the old `expo-router ~5.1.11` era — instead of the `^57.0.2` that `expo-router@57.0.2` and `@expo/router-server@57.0.1` actually require (`pnpm peers check` flagged this as an unmet peer). A `pnpm-workspace.yaml` `overrides` entry did not change the resolution; adding `"@expo/metro-runtime": "~57.0.2"` as a direct dependency of `apps/mobile/package.json` did — pnpm then resolves a single current `57.0.2` everywhere. Left as a direct dependency, not an override, since that's what actually worked.

### What's deliberately NOT adopted from the new default template

The current `create-expo-app@latest` default template made a few choices that are template defaults, not SDK requirements, and are not adopted here:

- **`src/app/` layout.** The new template nests `app/` under `src/`. `apps/mobile/CLAUDE.md` and ADR 0023 document a root-level `app/` / `application/` / `domain/` / `infrastructure/` layout; expo-router supports both conventions equally, so the existing root-level layout is kept unchanged.
- **`experiments.reactCompiler` and `experiments.typedRoutes`.** Both are new opt-in flags in the template's `app.json`. Turning on the React Compiler changes runtime behavior (auto-memoization) for existing code that was never written or reviewed against it; typed routes is a genuinely low-risk additive feature but is still a new capability, not something required to reach parity on the new SDK. Neither is enabled here — this change is scoped to reaching the same app on a newer SDK, not adopting new Expo capabilities. Both are reasonable V2+ candidates.
- **`newArchEnabled` config key removed**, not carried forward. The New Architecture is mandatory as of this RN/Expo generation (there is no legacy architecture left to toggle away from), and the reference scaffold's `app.json` no longer includes the key at all.
- **`android.predictiveBackGestureEnabled: false` is adopted**, unlike the two items above — this isn't a new feature, it's a known Android-13+/react-native-screens compatibility flag the Expo team now sets by default in the template to avoid predictive-back-gesture glitches with the native stack navigator. Since the app already uses `react-native-screens` on Android, this is carried forward.

### Native projects

`ios/` and `android/` are deleted and regenerated via `npx expo prebuild --clean` against the rebuilt `app.config.ts`, rather than patched. `plugins/withFmtCxx17Fix.js` (the Folly/`fmt` C++20 `consteval` workaround for newer Xcode/Clang) is re-evaluated empirically: a clean prebuild + `pod install` is attempted first without it, and it is only reinstated if the same build error reproduces against SDK 57's pinned `fmt` pod version.

### Supply-chain guardrail

pnpm's `minimumReleaseAge` check is non-blocking by default: on `pnpm install`, it auto-appends any too-fresh transitive package to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` and proceeds (only `minimumReleaseAgeStrict: true` would turn this into a gating prompt). Running `pnpm install` for real against the version table above reproduced the same 18-entry list the abandoned attempt had hand-copied — confirming those entries are genuinely required for this dependency set, not an arbitrary bypass. The list is left as pnpm generated it rather than hand-edited.

### Process

Work happens on a branch (`mobile/expo-sdk-rescaffold`), not on `main`. It merges to `main` only after the app builds and boots to a working Login screen on **both** a real iOS simulator build (`expo run:ios`) and a real Android emulator build (`expo run:android`) — the concrete regression the abandoned attempt introduced ("not booting cleanly") must be shown fixed on both platforms before this lands, not assumed fixed from a green `type-check`.

## Status

accepted

## Consequences

- The dependency table above is the new baseline; any future SDK bump should repeat the "generate a throwaway reference scaffold, diff against it" approach rather than hand-picking version numbers.
- `experiments.reactCompiler` and `experiments.typedRoutes` remain open V2+ options — adopting either is a separate decision with its own review, not a side effect of this upgrade.
- `withFmtCxx17Fix` may or may not still be necessary; its continued presence (or removal) is determined empirically during this change and should be visible in the commit that touches `plugins/` and `app.config.ts`.

## V2+ items

- Evaluate `experiments.reactCompiler` (React Compiler) once there's enough screen surface to meaningfully assess its effect.
- Evaluate `experiments.typedRoutes` for compile-time-checked `router.push()` calls.
- EAS Build pipeline (already listed as V2+ in ADR 0023) would make this class of upgrade lower-risk in the future by building both platforms in CI on every dependency bump.
