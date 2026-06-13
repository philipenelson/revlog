import type { Session } from '@/model/types';

const store = <{session: Session | null}>{
  session: null
};

const sessionService = {
  getSession: () => store.session,
  setSession: (newSession: Session | null) => (store.session = newSession),
  clearSession: () => (store.session = null),
};

export { sessionService };