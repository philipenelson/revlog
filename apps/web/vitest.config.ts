import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// ViewModel + pure-logic unit tests (ADR 0043). Pure functions run in the jsdom
// environment too (harmless); hook-shell tests need it for renderHook.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    // Cypress specs live under cypress/ and are not vitest tests.
    exclude: ['node_modules', '.next', 'cypress'],
  },
});
