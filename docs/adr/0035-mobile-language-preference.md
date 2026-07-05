# Mobile language selector + persisted locale preference (i18n deferred)

## Context

The Settings screen gets a Language control (UC-MOB-SETTINGS-4). Full internationalization — a translation library, extracted string catalogs, plural/format handling, migrating every existing screen — is a larger V1 effort that will land later and get its own ADR + spec. What this task needs is the **entry point**: let the Owner pick a language and have that choice persist, so the future i18n work has a stored locale to read.

No i18n library exists anywhere in the repo today, and there is no non-token persistence mechanism (`AsyncStorage` is not installed; `secureStorage.ts` is reserved for secrets — tokens and the DB key).

## Decision

Ship **the selector and a persisted locale preference only** — no i18n library, no string translation, in this task.

- **Supported locales (V1 initial set):** `en` (English, source), `pt-BR` (Português — Brasil), `es` (Español). Defined as a small constants module with display labels; the picker offers exactly these.
- **Default:** `en` when nothing is stored. (Defaulting to the device locale is deferred to the i18n effort, since it needs `expo-localization`.)
- **Persistence:** a new `infrastructure/storage/preferences.ts` module wrapping `expo-secure-store` for **non-secret device preferences**, kept separate from `secureStorage.ts` (secrets) for clarity. One `locale` key. Chosen over adding `@react-native-async-storage/async-storage` to avoid a new dependency (and its install-script surface); the Keychain/Keystore is an acceptable home for a single small preference and is readable pre-auth, which the future i18n layer will need.
- **Consumption:** the Settings viewmodel reads the stored locale on mount (default `en`) and writes it on selection. Nothing else consumes it yet — the control is real (its selection survives restarts) but does not visibly translate any strings until the i18n effort lands.

## Status

accepted

## Consequences

- The picker persists a choice that the app does not yet act on visually. This is intentional and called out in the settings spec — it seeds the i18n effort rather than blocking on it.
- When full i18n arrives, it reads the same `locale` key, adds device-locale defaulting via `expo-localization`, and swaps the "does nothing visible" note for real string switching. The stored-preference contract does not change.
- No architectural coupling to any i18n library is created now, so that choice stays open for the dedicated i18n ADR.

## V2+ items

- Full internationalization (library, string catalogs, all screens, device-locale default, RTL) → later V1 effort, own ADR + spec — **not** V2, but out of scope for this task.
- Additional locales beyond en / pt-BR / es → added with the i18n effort as catalogs are authored.
