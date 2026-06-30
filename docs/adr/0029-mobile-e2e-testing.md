# Mobile testing: Jest for unit tests, Appium for E2E

## Context

The web app uses Vitest for unit tests and Cypress for E2E tests. The mobile app runs on a different runtime (React Native / native iOS and Android) and requires a different testing stack.

### Unit tests

Jest ships with Expo and is the natural unit testing framework for React Native. It runs in Node, supports TypeScript via ts-jest or babel-jest, and integrates with React Native Testing Library if component-level tests are ever needed. Equivalent in role to Vitest on the web.

### E2E tests

Three frameworks were evaluated for mobile E2E:

**Detox** — the established React Native E2E framework. Purpose-built for React Native; runs from inside the app process giving it direct visibility into the UI state. Requires native build tooling (Xcode, Android Studio) and is tightly coupled to React Native internals. Significant setup complexity.

**Maestro** — newer (2022), YAML-based mobile E2E framework. 14K GitHub stars. Simple to set up, no driver installation required. Growing momentum in the indie/startup mobile dev community but limited presence in enterprise job listings.

**Appium** — the industry-standard cross-platform mobile automation framework. Supports iOS (via XCUITest) and Android (via UIAutomator2) from a single test suite. Most widely cited mobile testing tool in job listings as of 2026. TypeScript-native with WebDriverIO. Can test both native and WebView content.

### Portfolio considerations

This project is a portfolio and showcase project. The testing stack choice carries job market signal. As of 2026:

- Playwright has surpassed Cypress in web E2E job demand (tripled postings 2024–2026; 33M weekly npm downloads vs Cypress's plateau). The web app's Cypress tests will migrate to Playwright in V2.
- Appium remains the most recognised mobile E2E framework in job postings. Pairing Playwright (web) with Appium (mobile) represents the most marketable full-stack testing portfolio.

### Humble object pattern

Screen components are logic-free (they only render viewmodel output). There is nothing worth unit-testing in a view — all logic is in the viewmodel, repository, or service. Unit tests cover viewmodels, repositories, and services. Appium E2E tests cover the views (the full user journey through the real app).

This is the same humble object principle applied on the web: viewmodels and services are unit-tested, screens are E2E-tested via Cypress (soon Playwright).

## Decision

- **Jest** for unit tests covering viewmodels, repositories, and services. No unit tests on Screen components.
- **Appium** (with WebDriverIO) for E2E tests covering the full user journey on real iOS and Android simulator/emulator builds.
- The **web Cypress → Playwright** migration is V2 scope, not part of this milestone.

## Status

accepted

## Consequences

- Jest runs in Node with no native dependencies — fast, cacheable, runnable in CI without a simulator.
- Appium E2E tests require a native build (`expo run:ios` / `expo run:android`) and a running simulator or emulator. These are slower and require more CI infrastructure; Appium setup is a tracked milestone item.
- The humble object pattern means every screen must have a corresponding Appium E2E test covering its primary happy path and error states — same requirement as Cypress on the web.
- Adopting both Appium (mobile) and Playwright (web, V2) produces a portfolio that demonstrates cross-platform E2E testing competence with the two most marketable frameworks in 2026.

## V2+ items

- **Playwright migration** — migrate web E2E from Cypress to Playwright. Playwright has significantly higher job market demand and momentum as of 2026.
- **EAS Build + CI** — run Appium tests against EAS-built binaries in CI (GitHub Actions or similar).
