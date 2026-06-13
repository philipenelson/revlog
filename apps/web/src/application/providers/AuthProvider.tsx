"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { refreshSession } from "@/model/services/authService";
import type { Session } from "@/model/types";
import { useRouter } from 'next/navigation';
import { sessionService } from '@/model/services/sessionService';
import { registerResponseInterceptor } from '@/infrastructure/http/apiClient';
import { logger } from '@/infrastructure/logging/logger';

interface AuthContextValue {
  session: Session | null;
  isRestoring: boolean;
  setSession: (session: Session) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isRestoring, setIsRestoring] = useState(true);
  const router = useRouter();

  useEffect(() => {
    registerResponseInterceptor((res, path, init) => {
      if (res.status === 401) {
        logger.info(`Authentication failed with 401 - ${init?.method} - ${path}`);
        router.push('/login');
      }
      return res;
    })
  }, [router]);

  // Reloading or directly navigating to a protected route wipes this in-memory
  // state (ADR 0016) but leaves the HttpOnly refreshToken cookie intact. Attempt
  // a silent restore on mount — the cookie is sent automatically. A 401 here just
  // means "not signed in," the overwhelming common case (e.g. every fresh visit
  // to /login) — not worth logging as an error. See UC-AUTH-7 (login.md) and ADR 0017.
  useEffect(() => {
    let cancelled = false;

    refreshSession()
      .then((restored) => {
        if (!cancelled) sessionService.setSession(restored);
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

  const value = {
    session: sessionService.getSession(),
    isRestoring,
    setSession: sessionService.setSession,
    clearSession: sessionService.clearSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
