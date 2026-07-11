import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount anything rendered by a hook-shell test between cases so React state
// and effects never bleed across tests.
afterEach(() => {
  cleanup();
});

// jsdom's object-URL impl rejects the File-like fixtures used in hook-shell
// tests (it demands a real Blob); viewmodels that preview picked media
// (log-entry) call these, so stub them unconditionally.
URL.createObjectURL = vi.fn(() => 'blob:mock');
URL.revokeObjectURL = vi.fn();
