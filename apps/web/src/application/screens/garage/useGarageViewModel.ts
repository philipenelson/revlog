"use client";

import { useEffect, useState } from "react";
import { ApiError, listVehicles, type VehicleSummary } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { logger } from "@/adapters/logging/logger";

export type GarageLoadState = "loading" | "loaded" | "error";

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
        //TODO: refactor 500 error handling through out
        if (!(err instanceof ApiError && err.status < 500)) {
          logger.error("failed to load garage vehicles", { err });
        }
        setLoadState("error");
      });

  }, []);

  const hasLoaded = loadState === "loaded";
  const isEmpty = hasLoaded && vehicles.length === 0;
  const isPopulated = hasLoaded && !isEmpty;

  return { loadState, vehicles, isEmpty, isPopulated };
}
