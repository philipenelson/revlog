'use client';

import { createContext, useContext } from 'react';
import type { MediaStore } from './MediaStore';

const MediaStoreContext = createContext<MediaStore | null>(null);

export function MediaStoreProvider({
  store,
  children,
}: {
  store: MediaStore;
  children: React.ReactNode;
}) {
  return <MediaStoreContext.Provider value={store}>{children}</MediaStoreContext.Provider>;
}

export function useMediaStoreContext(): MediaStore {
  const ctx = useContext(MediaStoreContext);
  if (!ctx) throw new Error('useMediaStoreContext must be used inside MediaStoreProvider');
  return ctx;
}
