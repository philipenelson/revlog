"use client";

import { useEffect, useState } from "react";
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
}

export function useGarageViewModel(): GarageViewModel {
  const [loadState, setLoadState] = useState<GarageLoadState>("loading");
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);

  useEffect(() => {
    listVehicles()
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
