# Cypress for web e2e testing

Cypress is added to `apps/web` as the e2e test runner. The alternative was Playwright, which has better multi-browser support and a slightly more modern API, but Cypress has wider recognition in job postings and a lower initial setup cost. Specs live in `apps/web/cypress/e2e/`; the config sets `baseUrl: http://localhost:3000` and `supportFile: false` to keep the setup lean. Tests target interactive UI behaviour that unit tests cannot cover — tab switching, field visibility, form state — using `data-testid` attributes as selectors, avoiding coupling to text content or CSS classes.

**Security:** Cypress requires a binary download at install time (a postinstall script). The project already uses `pnpm-workspace.yaml` `allowBuilds` as the mechanism for whitelisting specific packages that need build scripts — Cypress was added there (`cypress: true`). This keeps the allow-list explicit and auditable; any new package requiring a build script must be consciously added to that file.

**Dev server stability:** Two operational scripts were added to `apps/web/package.json` to prevent the stale-cache failure mode discovered during initial setup: `predev` kills any process holding port 3000 before `next dev` starts (preventing zombie servers from forcing fallback ports and reusing stale `.next` cache), and `dev:clean` explicitly deletes `.next` before starting for cases where incremental cache is genuinely stale. `predev` runs automatically on every `pnpm dev`; `dev:clean` is a manual escape hatch. Note: `predev` only fires when invoking `pnpm dev` directly inside `apps/web/` — Turbo bypasses it when running from the monorepo root.

## Status

accepted

## V2 consideration

Add Playwright alongside or instead of Cypress if multi-browser coverage or mobile viewport testing becomes a priority. The `data-testid` selector strategy is browser-agnostic and would transfer with no changes.
