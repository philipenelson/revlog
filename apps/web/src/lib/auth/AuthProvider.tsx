"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AccountStatus } from "@maintenance-log/domain";
import { apiFetch } from "@/infrastructure/http/apiClient";

export interface Session {
  accessToken: string;
  user: { id: string; accountId: string; role: string };
  account: { id: string; status: AccountStatus };
}

interface AuthContextValue {
  session: Session | null;
  isRestoring: boolean;
  setSession: (session: Session) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const setSession = useCallback((next: Session) => setSessionState(next), []);
  const clearSession = useCallback(() => setSessionState(null), []);

  // Reloading or directly navigating to a protected route wipes this in-memory
  // state (ADR 0016) but leaves the HttpOnly refreshToken cookie intact. Attempt
  // a silent restore on mount — apiFetch's credentials: "include" sends the
  // cookie automatically. A 401 here just means "not signed in," the overwhelming
  // common case (e.g. every fresh visit to /login) — not worth logging as an error.
  // See UC-AUTH-7 (login.md) and ADR 0017.
  useEffect(() => {
    let cancelled = false;

    apiFetch<Session>("/auth/refresh", { method: "POST" })
      .then((restored) => {
        if (!cancelled) setSessionState(restored);
      })
      .catch(() => {
        // No valid session to restore — consumers gate on `isRestoring` and
        // fall back to their existing no-session handling once it settles.
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ session, isRestoring, setSession, clearSession }),
    [session, isRestoring, setSession, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
