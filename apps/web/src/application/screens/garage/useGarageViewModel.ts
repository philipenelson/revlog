"use client";

import { useEffect, useState } from "react";
import { listVehicles, type VehicleSummary } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { logger } from "@/adapters/logging/logger";
import { isUserFacingError } from "@/domain/apiError";

export type GarageLoadState = "loading" | "loaded" | "error";

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

export interface GarageViewModel {
  loadState: GarageLoadState;
  vehicles: VehicleSummary[];
  isEmpty: boolean;
  isPopulated: boolean;
}

export function useGarageViewModel(): GarageViewModel {
  const [loadState, setLoadState] = useState<GarageLoadState>("loading");
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);

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

  const { isEmpty, isPopulated } = deriveGarageFlags(loadState, vehicles.length);

  return { loadState, vehicles, isEmpty, isPopulated };
}
