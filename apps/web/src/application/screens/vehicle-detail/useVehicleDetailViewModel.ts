"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/application/providers/AuthProvider";
import { ApiError } from "@/model/errors";
import { getVehicle } from "@/model/services/vehicleService";
import { saveInsurance } from "@/model/services/insuranceService";
import {
  vehicleDisplayName,
  type InsuranceInput,
  type LogEntrySummary,
  type VehicleDetail,
} from "@/model/types";
import { logger } from "@/infrastructure/logging/logger";

export type VehicleDetailLoadState = "loading" | "loaded" | "error" | "not-found";

export interface VehicleDetailViewModel {
  vehicleId: string;
  loadState: VehicleDetailLoadState;
  vehicle: VehicleDetail | null;
  displayName: string;
  retry: () => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  filteredEntries: LogEntrySummary[];
  insuranceOpen: boolean;
  insuranceEditMode: boolean;
  openInsurance: (editMode: boolean) => void;
  closeInsurance: () => void;
  handleInsuranceSave: (input: InsuranceInput) => Promise<void>;
}

export function useVehicleDetailViewModel(): VehicleDetailViewModel {
  const router = useRouter();
  const params = useParams<{ vehicleId: string }>();
  const vehicleId = params.vehicleId;
  const { session, isRestoring } = useAuth();

  const [loadState, setLoadState] = useState<VehicleDetailLoadState>("loading");
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const [insuranceEditMode, setInsuranceEditMode] = useState(false);

  function retry() {
    setLoadState("loading");
    setRetryToken((n) => n + 1);
  }

  useEffect(() => {
    if (isRestoring) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    getVehicle(session.accessToken, vehicleId)
      .then((vehicle) => {
        if (cancelled) return;
        setVehicle(vehicle);
        setLoadState("loaded");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setLoadState("not-found");
        } else {
          logger.error("failed to load vehicle detail", { err });
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, isRestoring, vehicleId, retryToken, router]);

  function openInsurance(editMode: boolean) {
    setInsuranceEditMode(editMode);
    setInsuranceOpen(true);
  }

  async function handleInsuranceSave(input: InsuranceInput): Promise<void> {
    const insurance = await saveInsurance(session!.accessToken, vehicleId, input);
    setVehicle((prev) => (prev ? { ...prev, insurance } : null));
  }

  const displayName = vehicle ? vehicleDisplayName(vehicle) : "Vehicle";

  const filteredEntries =
    vehicle && typeFilter !== "ALL"
      ? vehicle.logEntries.filter((e) => e.typeId === typeFilter)
      : vehicle?.logEntries ?? [];

  return {
    vehicleId,
    loadState,
    vehicle,
    displayName,
    retry,
    typeFilter,
    setTypeFilter,
    filteredEntries,
    insuranceOpen,
    insuranceEditMode,
    openInsurance,
    closeInsurance: () => setInsuranceOpen(false),
    handleInsuranceSave,
  };
}
