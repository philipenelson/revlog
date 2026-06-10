'use client';

import { createContext, useContext, useState } from 'react';
import type { MediaStore } from './MediaStore';
import { OpfsMediaStore } from './OpfsMediaStore';

const MediaStoreContext = createContext<MediaStore | null>(null);

export function MediaStoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<MediaStore>(() => new OpfsMediaStore());
  return <MediaStoreContext.Provider value={store}>{children}</MediaStoreContext.Provider>;
}

export function useMediaStoreContext(): MediaStore {
  const ctx = useContext(MediaStoreContext);
  if (!ctx) throw new Error('useMediaStoreContext must be used inside MediaStoreProvider');
  return ctx;
}
