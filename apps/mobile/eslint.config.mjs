import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Flat config for the mobile app (React Native/Expo, TypeScript). typescript-
// eslint recommended + the React Hooks rules; native projects, build output,
// tooling configs, and the Appium E2E suite are ignored. Run via
// `pnpm --filter @maintenance-log/mobile lint` (eslint .).
export default tseslint.config(
  {
    ignores: ['.expo/**', 'android/**', 'ios/**', 'e2e/**', 'coverage/**', '*.config.js', '*.config.ts'],
  },
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Underscore-prefixed args/vars are intentionally unused (ignored
      // destructured fields, unused fake-fn params in tests); also allow the
      // `...rest` sibling of an omitted destructured field.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // React Native and Jest use require() idiomatically (assets, jest.mock).
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
