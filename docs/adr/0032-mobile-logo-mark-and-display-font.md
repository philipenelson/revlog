# Mobile: logo mark (react-native-svg) and Outfit display font loading

## Context

Comparing the running Welcome/Login/Register screens against [`revlog-mobile-auth.html`](../designs/mobile/revlog-mobile-auth.html) — the only design file that existed for these screens — surfaced two gaps:

1. **Missing logo mark.** The design shows a small speedometer/gauge icon (an SVG: a muted background arc, a teal foreground arc, a needle, and a red "redline" dot) above the wordmark on both Login and Register. The shipped screens render only the text wordmark, no icon.
2. **Missing display font.** `packages/ui/tokens/src/typography.ts` has always defined `fontFamily.display: 'Outfit'`, and the wordmark/heading styles on Welcome, Login, and Register all reference it — but no font-loading package was ever installed or wired up in `app/_layout.tsx`. Every screen has been silently falling back to the OS system font instead of Outfit.

Additionally, Welcome and the native splash screen had no dedicated design file at all: Welcome's spec (`docs/specs/mobile-app/welcome.md`) explicitly deferred `revlog-mobile-welcome.html` as a "follow-up before this screen ships pixel-perfect" (see [ADR 0030](0030-mobile-welcome-screen.md)), and the splash screen (`apps/mobile/assets/splash-icon.png`) has only ever been a 1×1 transparent placeholder that exists purely to satisfy `expo-splash-screen`'s Android plugin (see [ADR 0031](0031-expo-sdk-57-rescaffold.md)) — never a real design.

## Decision

### Logo mark: `react-native-svg`, not a rasterized image

The icon is small, flat-colored geometry (two arcs, a line, two dots) — a genuine vector shape, not a photo or illustration. `react-native-svg` (already the de facto standard SVG renderer for React Native/Expo) draws it live, matching exactly what a web `<svg>` element would render, and lets it participate correctly in the token system (`stroke`/`fill` use `colors.teal[500]` / `colors.danger[500]` directly, same as any other themed color in the app — no baked-in hex values in an image asset).

A new component, `apps/mobile/application/components/RevlogMark.tsx`, wraps the SVG with a `size` prop. It is used by Welcome, Login, and Register above their existing wordmark/heading — the same three places the design calls for it.

The one muted-arc color in the design (`#1E2235`) doesn't exactly match any existing `neutral` token — same situation the original screens already accepted for input borders (design called for `#2A2E46`, shipped as `colors.neutral[400]`). `colors.neutral[600]` (`#1A1D2E`) is the closest match and is what the mark uses; not introducing a new token for one specific shade a design mockup happened to pick.

### Display font: `expo-font` + `@expo-google-fonts/outfit`, loaded before the splash hides

`expo-font`'s `useFonts()` hook is the standard Expo mechanism for loading custom fonts; `@expo-google-fonts/outfit` ships pre-built static `.ttf` files per weight, matching how `next/font/google` already serves Outfit on web (see `apps/web/src/app/layout.tsx`).

**Static per-weight font loading, not a variable font.** Google Fonts' Expo packages register each weight as its own named font (`Outfit_400Regular`, `Outfit_600SemiBold`, `Outfit_700Bold`), not a single `'Outfit'` family selectable via a `fontWeight` style prop the way `next/font`'s variable-font CSS works on web. React Native does not reliably honor `fontWeight` against a statically-loaded custom font — only an exact `fontFamily` match renders the intended weight. `fontFamily.display` is therefore split into three explicit tokens:

```ts
export const fontFamily = {
  display: 'Outfit_400Regular',
  displaySemibold: 'Outfit_600SemiBold',
  displayBold: 'Outfit_700Bold',
  sans: 'DM Sans',
  mono: 'Geist Mono',
} as const;
```

Every existing `fontFamily: fontFamily.display` + `fontWeight: fontWeight.X` pairing is replaced with the matching single weight-specific token, and the now-redundant `fontWeight` is dropped from those specific styles (keeping it risks a synthetic/faux-bold applied on top of an already-bold static font file on some platforms).

`fontFamily.sans` (`'DM Sans'`) and `fontFamily.mono` (`'Geist Mono'`) are untouched — nothing in the mobile app references either yet, so loading them now would be speculative. They get the same treatment the first time a screen actually needs them.

**Splash gating.** `SplashController` already defers hiding the native splash via `onLayout`; it's extended to also wait on `useFonts()`'s `fontsLoaded` boolean before calling `hideAsync()`, so there's no flash of system-font text between the splash disappearing and Outfit becoming available.

### New design files

- [`revlog-mobile-welcome.html`](../designs/mobile/revlog-mobile-welcome.html) — the deferred Welcome preview, same visual system as `revlog-mobile-auth.html` (dark surface, logo mark, wordmark, tagline) plus the two CTAs already shipped.
- [`revlog-mobile-splash.html`](../designs/mobile/revlog-mobile-splash.html) — the native splash screen: just the surface color and the logo mark centered, since that's genuinely all a platform splash screen can show (a static image over a background color, no live rendering).

### Splash asset generation

The native splash screen renders a static image, not live SVG — `expo-splash-screen`'s `image` config point at a raster file. `apps/mobile/assets/splash-icon.png` is regenerated from the same `RevlogMark` geometry (rendered once, offline, via `sharp`, at 512×512 with a transparent background) rather than hand-exported, so the live icon and the splash icon are guaranteed to stay in sync — there's exactly one source of truth for the shape (the SVG path data, currently duplicated between the `RevlogMark` component and the one-off generation script; see Consequences).

### Register screen: `KeyboardAvoidingView` + `ScrollView` (discovered, not part of the original ask)

Adding the mark pushed the Register form down by its height, and that was enough to move the confirm-password field fully behind the software keyboard once focused. This wasn't just an Appium artifact — XCUITest's own accessibility snapshot reported the field `visible="false"` while it was covered, and keystrokes were misdirected to whatever field still had focus instead. A real user hitting the same overlap on a smaller device would have the same problem: unable to see or reliably tap the confirm-password field.

Register (four fields, the tallest of the three auth screens) is now wrapped in `KeyboardAvoidingView` (`behavior="padding"` on iOS) + `ScrollView`, so the form shrinks/scrolls to stay above the keyboard rather than being covered by it. Welcome (no text inputs) and Login (two fields, never observed to have this problem) are unchanged — this is scoped to the screen that actually broke, not applied speculatively everywhere.

## Status

accepted

## Consequences

- `react-native-svg` and `expo-font` are now real dependencies (previously only transitive/absent). Both are mainstream, actively-maintained Expo-ecosystem packages — no new architectural risk.
- The three-screen wordmark/heading fidelity gap (no icon, wrong font) is closed. Any *future* screen that wants the display font must use one of the three explicit weight tokens, not a bare `fontFamily.display` + arbitrary `fontWeight` combination — this is a real constraint the previous single-token shape hid.
- The splash icon PNG and the live `RevlogMark` SVG component both encode the same path data by hand in two places (a one-off generation script and the component). Given the shape is fixed brand geometry that doesn't change often, this duplication was accepted rather than building tooling to derive one from the other for a single icon — revisit if more icons are added.
- `fontFamily.sans` / `fontFamily.mono` remain unloaded on mobile; the first screen that needs body text or monospace styling picks this back up.
- Register gained real keyboard-avoidance it didn't have before, fixing a genuine (if previously unnoticed) usability gap on top of the design-fidelity fix this ADR set out to make.
