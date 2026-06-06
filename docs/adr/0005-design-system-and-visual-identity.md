# Design system: shared token package as source of truth

`packages/ui/tokens/src/` is the single authoritative source for all design token values. It exports typed TypeScript constants (`colors`, `fontSize`, `fontWeight`, `lineHeight`, `fontFamily`, `spacing`) consumed directly by React Native and any non-CSS platform. The web app (`apps/web/src/app/globals.css`) translates those values into CSS custom properties and wires them into Tailwind v4's utility layer via a `@theme inline` block, so Tailwind classes and raw `style` props both resolve from the same values. Currently that translation is manual — the hex values in `globals.css` are kept in sync with `colors.ts` by hand. The V2 goal is to generate the CSS layer from the token package automatically.

**Visual identity — Revlog web app:**
- Theme: dark-only. No light mode in V1. `--surface-base` (#0B0D14) as the page background; `--surface-raised` (#131620) for card/panel surfaces.
- Accent: electric teal (`--accent` #14B8D4). Single accent colour — no secondary palette. Chosen for the digital-instrument-cluster aesthetic appropriate to a motorcycle app.
- Typography: `Outfit` (variable, 300–700) for headings and display text; `DM Sans` (variable, opsz axis) for body copy; `Geist Mono` for numerical and technical data. Fonts are loaded via `next/font/google` in the root layout; CSS variables `--font-outfit`, `--font-dm-sans`, and `--font-geist-mono` expose them to all consumers.
- Logo: inline SVG tachometer arc — 300° gauge sweep (7 o'clock → 5 o'clock), teal active arc at ~75% of sweep, needle pointing upper-right, red dot at redline. Wordmark: "Rev" (weight 300) + "log" (weight 700, teal).

The approved design was iterated in a throwaway standalone HTML preview (`/tmp/revlog-login-preview.html`) before any project files were touched, establishing a fast preview-then-implement loop to use for subsequent screens.

## Status

accepted

## V2 consideration

Auto-generate the CSS custom property layer from the token package (e.g. a build step that writes `packages/ui/tokens/tokens.css` from the TypeScript constants), eliminating the manual sync between `colors.ts` and `globals.css`.
