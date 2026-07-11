"use client";

import { useEffect, useState } from "react";
import { listVehicles, type VehicleSummary } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { logger } from "@/adapters/logging/logger";
import { isUserFacingError } from "@/domain/apiError";
import { deriveGarageFlags, type GarageLoadState } from "./garage.logic";

export type { GarageLoadState };

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
