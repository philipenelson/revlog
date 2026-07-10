import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount anything rendered by a hook-shell test between cases so React state
// and effects never bleed across tests.
afterEach(() => {
  cleanup();
});
