import tseslint from 'typescript-eslint';

// Flat config for the API (Node/Express, TypeScript). typescript-eslint's
// recommended set is the baseline; the generated Prisma client and build output
// are ignored. Run via `pnpm --filter @maintenance-log/api lint` (eslint src).
export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'src/generated/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Underscore-prefixed args/vars are intentionally unused — notably the
      // 4th `_next` param an Express error handler must declare to be recognised.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `declare global { namespace Express { ... } }` is the standard way to
      // augment Express's Request type — allow declaration namespaces.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    },
  },
);
