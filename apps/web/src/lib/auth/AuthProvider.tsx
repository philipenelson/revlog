"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AccountStatus } from "@maintenance-log/domain";

export interface Session {
  accessToken: string;
  user: { id: string; accountId: string; role: string };
  account: { id: string; status: AccountStatus };
}

interface AuthContextValue {
  session: Session | null;
  setSession: (session: Session) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);

  const setSession = useCallback((next: Session) => setSessionState(next), []);
  const clearSession = useCallback(() => setSessionState(null), []);

  const value = useMemo(() => ({ session, setSession, clearSession }), [session, setSession, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
