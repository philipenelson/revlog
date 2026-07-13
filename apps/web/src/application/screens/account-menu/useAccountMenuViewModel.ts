"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, getCurrentUser, logout as logoutRequest, type UserProfile } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { useAuth } from "@/application/providers/AuthProvider";
import { logger } from "@/adapters/logging/logger";
import { isUserFacingError } from "@/domain/apiError";

export const LOGOUT_NETWORK_ERROR = "You need to be online to log out.";

// Two-letter initials for the avatar trigger, e.g. "Jordan Reyes" -> "JR".
// A single-word name falls back to its first two letters.
export function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Logout mirrors mobile's online-required semantics (ADR 0034): a server
// *response* — success or an error status like 401 for an already-invalid
// session — means the session is settled either way, so logout completes
// locally. Only a genuine network failure (no response) should keep the
// session and surface an error.
export function isLogoutNetworkFailure(err: unknown): boolean {
  return !(err instanceof ApiError);
}

export interface AccountMenuViewModel {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  profile: UserProfile | null;
  isLoggingOut: boolean;
  logoutError: string | null;
  onLogout: () => void;
}

// Self-contained: no props in from the caller (currently only GarageScreen's
// header). This view has no relationship to whatever screen embeds it beyond
// "visible or not" — it owns its own data (account info) and behaviour
// (legal links, logout) independently of the Garage vehicle list.
export function useAccountMenuViewModel(): AccountMenuViewModel {
  const router = useRouter();
  const { clearSession } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Fetched once up front (not on menu open) so the dropdown renders
  // instantly — web has no offline cache to read from first, unlike
  // mobile's ProfileRepository, so this is the closest equivalent to
  // "already available" by the time the Owner opens the menu.
  useEffect(() => {
    getCurrentUser(cookieHttpClient)
      .then(setProfile)
      .catch((err) => {
        if (!isUserFacingError(err)) {
          logger.error("failed to load account profile", { err });
        }
      });
  }, []);

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logoutRequest(cookieHttpClient);
      clearSession();
      router.push("/login");
    } catch (err) {
      if (isLogoutNetworkFailure(err)) {
        logger.warn("logout failed — no server response (offline)", { err });
        setLogoutError(LOGOUT_NETWORK_ERROR);
        setIsLoggingOut(false);
      } else {
        clearSession();
        router.push("/login");
      }
    }
  }

  return {
    isOpen,
    toggle: () => setIsOpen((open) => !open),
    close: () => setIsOpen(false),
    profile,
    isLoggingOut,
    logoutError,
    onLogout: () => void handleLogout(),
  };
}
