#!/usr/bin/env node
/**
 * Rule A enforcement: no raw design token values outside packages/ui/tokens/src/
 *
 * Scans staged .ts, .tsx, and .css files (excluding the token package itself)
 * for hardcoded hex color patterns. Fails the commit with file:line details
 * if any are found.
 *
 * Run manually:  node scripts/check-raw-tokens.mjs
 * Run in hook:   automatically called by scripts/pre-commit
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = execSync("git rev-parse --show-toplevel").toString().trim();

const staged = execSync("git diff --cached --name-only --diff-filter=ACM")
  .toString()
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((f) => /\.(ts|tsx|css)$/.test(f))
  .filter((f) => !f.startsWith("packages/ui/tokens/src/"));

if (staged.length === 0) process.exit(0);

// Matches hex color literals: #abc, #aabbcc, #aabbccdd (3, 6, or 8 hex digits)
const HEX_RE = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?(?![0-9a-fA-F])/;

const violations = [];

for (const file of staged) {
  const content = readFileSync(join(ROOT, file), "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip pure comment lines
    if (/^\s*(\/\/|\/\*|\*|<!--)/.test(line)) continue;
    if (HEX_RE.test(line)) {
      violations.push(`  ${file}:${i + 1}  →  ${line.trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error(
    "\n\x1b[31m✖ Raw color values found outside packages/ui/tokens/src/:\x1b[0m\n"
  );
  violations.forEach((v) => console.error(v));
  console.error(
    "\n\x1b[33mDefine all design token values in packages/ui/tokens/src/ only.\x1b[0m"
  );
  console.error("See CLAUDE.md Rule A and docs/adr/0007-style-architecture-guardrails.md\n");
  process.exit(1);
}
