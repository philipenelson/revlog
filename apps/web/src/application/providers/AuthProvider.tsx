"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { refreshSession } from "@maintenance-log/api-client";
import type { Session } from "@maintenance-log/api-client";
import { useRouter } from 'next/navigation';
import { sessionStore } from '@/adapters/session/sessionStore';
import { cookieHttpClient, registerRequestInterceptor, registerResponseInterceptor } from '@/adapters/http/CookieHttpClient';
import { authRequestInterceptor, createUnauthorizedInterceptor } from '@/adapters/http/authInterceptor';
import { logger } from '@/adapters/logging/logger';

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

  // Wire the auth interceptors into the generic HTTP client: one proactively
  // refreshes + attaches the token, one redirects on an unhandled 401. The
  // interceptor logic is framework-free (adapters/http); this only registers
  // it and supplies the navigation. Cleanup avoids accumulating handlers.
  useEffect(() => {
    const offRequest = registerRequestInterceptor(authRequestInterceptor);
    const offResponse = registerResponseInterceptor(
      createUnauthorizedInterceptor(() => {
        sessionStore.clearSession();
        logger.info('Authentication failed (401) — redirecting to /login');
        router.push('/login');
      }),
    );
    return () => {
      offRequest();
      offResponse();
    };
  }, [router]);

  // Reloading or directly navigating to a protected route wipes this in-memory
  // state (ADR 0016) but leaves the HttpOnly refreshToken cookie intact. Attempt
  // a silent restore on mount — the cookie is sent automatically. A 401 here just
  // means "not signed in," the overwhelming common case (e.g. every fresh visit
  // to /login) — not worth logging as an error. See UC-AUTH-7 (login.md) and ADR 0017.
  useEffect(() => {
    let cancelled = false;

    refreshSession(cookieHttpClient)
      .then((restored) => {
        if (!cancelled) sessionStore.setSession(restored);
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
    session: sessionStore.getSession(),
    isRestoring,
    setSession: sessionStore.setSession,
    clearSession: sessionStore.clearSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
