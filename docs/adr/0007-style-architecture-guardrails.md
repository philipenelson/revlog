# Style architecture: token package as source of truth, no inline styles

Two non-negotiable rules govern all styling in this project.

**Rule A:** All raw design values (hex colors, spacing px, border radii, font sizes) must be defined in `packages/ui/tokens/src/` and nowhere else. CSS files in apps reference them via `var(--token-name)`; components reference them via Tailwind classes or CSS Modules. The token package is the cross-platform source of truth for web, mobile, and marketing site. Defining a value outside the token package creates silent drift — the same color can diverge across platforms with no compiler warning.

**Rule B:** The `style={{}}` prop is banned in JSX/TSX files. Inline style objects bypass the token system, are not statically analysable, and cannot be co-located in a style file for review. Use Tailwind classes for utility-expressible styles; use a co-located `.module.css` for anything else. This rule was introduced after the initial `apps/web/src/app/(auth)/login/page.tsx` was written entirely with inline style objects — a pattern that must not be repeated.

Both rules are enforced automatically:

- **ESLint** (`no-restricted-syntax`, selector `JSXAttribute[name.name='style']`) — errors on any `style=` attribute in JSX. Runs on `pnpm lint` and in the pre-commit hook.
- **`scripts/check-raw-tokens.mjs`** — scans staged `.ts`, `.tsx`, and `.css` files outside `packages/ui/tokens/src/` for raw hex color patterns; fails with file and line number on any match.
- **`scripts/pre-commit`** — orchestrates both checks; installed to `.git/hooks/pre-commit` via `pnpm hooks`.

## Status

accepted

## V2 consideration

Automate the translation from `packages/ui/tokens/src/` TypeScript constants to a generated `packages/ui/tokens/tokens.css` file imported by `globals.css`. This eliminates the manual sync and makes the token package the enforced source of truth at build time, not just at lint time.
