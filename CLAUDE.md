# Revlog — Development Rules

## Style Architecture (non-negotiable)

### Rule A — Design tokens live only in `packages/ui/tokens/src/`

Never define raw color, spacing, radius, or typography values anywhere outside this package. That means no hex codes, no `rgb()`, no hardcoded pixel values for spacing/radius in:
- CSS files (including `globals.css` — it must reference `var(--token-name)` only)
- Component or screen files (`.tsx`, `.ts`)
- Any other package or app

The web app's `globals.css` translates token values into CSS custom properties and bridges them into Tailwind via `@theme inline`. Until the CSS generation step is automated, keep `globals.css` in sync with the token package manually — but the token package is always the source of truth.

### Rule B — No inline styles in components or screens

Never use the `style={{}}` prop in JSX/TSX files. Use:
- **Tailwind utility classes** (`className`) for anything expressible as a utility
- **CSS Modules** (`.module.css` co-located with the component) for styles that need dynamic selectors, pseudo-elements, or cannot be expressed as Tailwind classes

Both rules are enforced by automated checks — see Guardrails below.

---

## Guardrails

### ESLint — no inline `style` prop
`apps/web/eslint.config.mjs` includes a `no-restricted-syntax` rule that errors on any `style=` attribute in JSX. This fires on `pnpm lint`.

### Pre-commit hook — no raw token values outside `packages/ui/tokens`
`scripts/pre-commit` runs on every `git commit`. It scans staged `.ts`, `.tsx`, and `.css` files (excluding `packages/ui/tokens/src/`) for raw hex color patterns and fails the commit if any are found.

Run `pnpm hooks` from the repo root after cloning to install the hook:
```
pnpm hooks
```

---

## Documentation (non-negotiable)

Documentation comes **before** implementation. Nothing gets built without a document first.

### Architecture decisions → ADR

Every decision about the stack, infrastructure, or technical approach requires an ADR in `docs/adr/`. This includes libraries chosen, patterns adopted, tools selected, and significant trade-offs made. Use the existing ADR format. No ADR = the decision didn't happen.

### Features → Spec with use cases and acceptance criteria

Every feature requires a spec file in `docs/specs/<area>/<feature>.md` before any code is written. The spec must include:
- **Use cases** — who does what, under what precondition, and what happens
- **Acceptance criteria** — a checklist of testable conditions that define "done"
- **Decisions** — significant choices made for this feature and why
- **V2+ items** — anything explicitly deferred, with rationale

Organize specs into subfolders by feature area (e.g. `docs/specs/auth/`, `docs/specs/garage/`).

### Use cases → Milestone

Every use case must appear in at least one milestone file in `docs/milestones/`. A use case can appear in multiple milestones when it is being iterated on (e.g. basic version in V1, enhanced version in V2). Milestones are the source of truth for what is in scope for a given release.

There are no exceptions to any of the above. Documentation is a first-class deliverable.

---

## Testing (non-negotiable)

### Every UI change requires an E2E test

Any change that affects the user interface must be covered by a Cypress E2E test in `apps/web/cypress/e2e/`. The test must cover:
- The primary happy path for the changed screen or component
- Any error states introduced or modified

### A feature is not done without automated tests

"Done" means: spec written, code merged, and automated tests passing. A feature with no test is not done, regardless of how the UI looks. This applies to every screen, every form, and every interactive behaviour.

---

## Workflow

### Implementation is step-by-step

Complete one logical step, confirm the goal was achieved, commit the changes, then move to the next step. Never batch multiple steps into a single commit unless explicitly asked.

---

## Domain

Product name in the UI is **Revlog**. Internal package namespace remains `maintenance-log`. See `CONTEXT.md` for full domain language glossary.
