"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/application/providers/AuthProvider";
import { ApiError } from "@/model/errors";
import { listVehicles } from "@/model/services/vehicleService";
import type { VehicleSummary } from "@/model/types";
import { logger } from "@/infrastructure/logging/logger";

export type GarageLoadState = "loading" | "loaded" | "error";

export interface GarageViewModel {
  loadState: GarageLoadState;
  vehicles: VehicleSummary[];
  isEmpty: boolean;
  isPopulated: boolean;
  retry: () => void;
}

export function useGarageViewModel(): GarageViewModel {
  const router = useRouter();
  const { session, isRestoring } = useAuth();
  const [loadState, setLoadState] = useState<GarageLoadState>("loading");
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [retryToken, setRetryToken] = useState(0);

  function retry() {
    setLoadState("loading");
    setRetryToken((n) => n + 1);
  }

  useEffect(() => {
    // AuthProvider attempts a silent restore on mount (UC-AUTH-7 / ADR 0017) —
    // wait for it to settle before deciding there's no session. Redirecting on
    // the first null would flash this screen away to /login even when the
    // restore was about to succeed.
    if (isRestoring) return;

    if (!session) {
      // Restoration genuinely failed — no valid refresh-token cookie to recover
      // from (expired, revoked, or never signed in). Re-authenticating is the
      // only path forward, so send them there directly rather than showing a
      // load-error whose "Try again" could never succeed.
      router.replace("/login");
      return;
    }

    let cancelled = false;

    listVehicles(session.accessToken)
      .then((vehicles) => {
        if (cancelled) return;
        setVehicles(vehicles);
        setLoadState("loaded");
      })
      .catch((err) => {
        if (cancelled) return;
        if (!(err instanceof ApiError && err.status < 500)) {
          logger.error("failed to load garage vehicles", { err });
        }
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [session, isRestoring, retryToken, router]);

  const hasLoaded = loadState === "loaded";
  const isEmpty = hasLoaded && vehicles.length === 0;
  const isPopulated = hasLoaded && !isEmpty;

  return { loadState, vehicles, isEmpty, isPopulated, retry };
}
