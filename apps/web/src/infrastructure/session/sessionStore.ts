import type { Session } from '@/model/types';

// In-memory session holder — the access token lives here and nowhere else
// (never localStorage/sessionStorage), per ADR 0002. Pure storage with no
// domain logic, so it belongs in infrastructure alongside the other adapters.
// Lost on reload by design; AuthProvider restores it via POST /auth/refresh.
const store = <{ session: Session | null }>{
  session: null,
};

const sessionStore = {
  getSession: () => store.session,
  setSession: (newSession: Session | null) => (store.session = newSession),
  clearSession: () => (store.session = null),
};

export { sessionStore };
