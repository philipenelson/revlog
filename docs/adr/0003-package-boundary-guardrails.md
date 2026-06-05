# Package boundary guardrails via eslint-plugin-boundaries

## Status

proposed — implement during monorepo bootstrap, before writing feature code

## Decision

Use `eslint-plugin-boundaries` to enforce import rules between packages and apps. Without guardrails, a well-intentioned import can quietly collapse the architecture (e.g. `packages/ui/tokens` importing from `react-native`, or `apps/mobile` importing a DOM-dependent component from `packages/ui/components`).

## Rules to enforce

| From | May import | May NOT import |
|------|-----------|----------------|
| `packages/domain` | external packages only | any local package or app |
| `packages/ui/tokens` | external packages only | any local package, `react-native`, any app |
| `packages/ui/components` | `packages/ui/tokens`, external packages | any app, `react-native` |
| `packages/config` | external packages only | any local package or app |
| `apps/web` | `packages/domain`, `packages/ui/tokens`, `packages/ui/components` | `apps/*`, `react-native` |
| `apps/website` | `packages/domain`, `packages/ui/tokens`, `packages/ui/components` | `apps/*`, `react-native` |
| `apps/mobile` | `packages/domain`, `packages/ui/tokens` | `apps/*`, `packages/ui/components` |
| `apps/api` | `packages/domain` | `apps/*`, `packages/ui/*`, `react-native` |
