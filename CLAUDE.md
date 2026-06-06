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

## Domain

Product name in the UI is **Revlog**. Internal package namespace remains `maintenance-log`. See `CONTEXT.md` for full domain language glossary.
