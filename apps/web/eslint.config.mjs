import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "cypress/**",
    "cypress.config.ts",
  ]),
  {
    rules: {
      // Rule B: no inline style props — use Tailwind classes or a CSS Module.
      // See CLAUDE.md and docs/adr/0007-style-architecture-guardrails.md
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='style']",
          message:
            "Inline styles are not allowed. Use Tailwind classes (className) or a CSS Module (.module.css). See CLAUDE.md Rule B.",
        },
      ],
    },
  },
]);

export default eslintConfig;
