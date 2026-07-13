"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getCurrentUser,
  listVehicles,
  logout as logoutRequest,
  type UserProfile,
  type VehicleSummary,
} from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { useAuth } from "@/application/providers/AuthProvider";
import { logger } from "@/adapters/logging/logger";
import { isUserFacingError } from "@/domain/apiError";

export type GarageLoadState = "loading" | "loaded" | "error";

export const LOGOUT_NETWORK_ERROR = "You need to be online to log out.";

// The empty/populated flags the view branches on. Both are false until the load
// settles as "loaded", so the view shows neither the empty state nor the grid
// while loading or on error.
export function deriveGarageFlags(
  loadState: GarageLoadState,
  vehicleCount: number,
): { isEmpty: boolean; isPopulated: boolean } {
  const hasLoaded = loadState === "loaded";
  const isEmpty = hasLoaded && vehicleCount === 0;
  return { isEmpty, isPopulated: hasLoaded && !isEmpty };
}

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

export interface GarageViewModel {
  loadState: GarageLoadState;
  vehicles: VehicleSummary[];
  isEmpty: boolean;
  isPopulated: boolean;
  accountMenu: AccountMenuViewModel;
}

export function useGarageViewModel(): GarageViewModel {
  const router = useRouter();
  const { clearSession } = useAuth();
  const [loadState, setLoadState] = useState<GarageLoadState>("loading");
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    listVehicles(cookieHttpClient)
      .then((vehicles) => {
        setVehicles(vehicles);
        setLoadState("loaded");
      })
      .catch((err) => {
        if (!isUserFacingError(err)) {
          logger.error("failed to load garage vehicles", { err });
        }
        setLoadState("error");
      });
  }, []);

  // Account info is fetched once up front (not on menu open) so the dropdown
  // renders instantly — web has no offline cache to read from first, unlike
  // mobile's ProfileRepository, so this is the closest equivalent to "already
  // available" by the time the Owner opens the menu.
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

  const { isEmpty, isPopulated } = deriveGarageFlags(loadState, vehicles.length);

  return {
    loadState,
    vehicles,
    isEmpty,
    isPopulated,
    accountMenu: {
      isOpen: isMenuOpen,
      toggle: () => setIsMenuOpen((open) => !open),
      close: () => setIsMenuOpen(false),
      profile,
      isLoggingOut,
      logoutError,
      onLogout: () => void handleLogout(),
    },
  };
}
