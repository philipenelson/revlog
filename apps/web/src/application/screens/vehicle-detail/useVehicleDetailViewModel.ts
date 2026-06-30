"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/model/errors";
import { getVehicle } from "@/model/services/vehicleService";
import { saveInsurance } from "@/model/services/insuranceService";
import { initiateTransfer, cancelTransfer } from "@/model/services/transferService";
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
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  filteredEntries: LogEntrySummary[];
  insuranceOpen: boolean;
  insuranceEditMode: boolean;
  openInsurance: (editMode: boolean) => void;
  closeInsurance: () => void;
  handleInsuranceSave: (input: InsuranceInput) => Promise<void>;
  retry: () => void;
  transferDialogOpen: boolean;
  openTransferDialog: () => void;
  closeTransferDialog: () => void;
  handleInitiateTransfer: (recipientEmail: string) => Promise<void>;
  cancelTransferDialogOpen: boolean;
  openCancelTransferDialog: () => void;
  closeCancelTransferDialog: () => void;
  handleCancelTransfer: () => Promise<void>;
}

export function useVehicleDetailViewModel(): VehicleDetailViewModel {
  const params = useParams<{ vehicleId: string }>();
  const vehicleId = params.vehicleId;

  const [loadState, setLoadState] = useState<VehicleDetailLoadState>("loading");
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const [insuranceEditMode, setInsuranceEditMode] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [cancelTransferDialogOpen, setCancelTransferDialogOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    getVehicle(vehicleId)
      .then((v) => {
        setVehicle(v);
        setLoadState("loaded");
      })
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setLoadState("not-found");
        } else {
          logger.error("failed to load vehicle detail", { err });
          setLoadState("error");
        }
      });
  }, [vehicleId, retryCount]);

  function openInsurance(editMode: boolean) {
    setInsuranceEditMode(editMode);
    setInsuranceOpen(true);
  }

  async function handleInsuranceSave(input: InsuranceInput): Promise<void> {
    const insurance = await saveInsurance(vehicleId, input);
    setVehicle((prev) => (prev ? { ...prev, insurance } : null));
  }

  const displayName = vehicle ? vehicleDisplayName(vehicle) : "Vehicle";

  const filteredEntries =
    vehicle && typeFilter !== "ALL"
      ? vehicle.logEntries.filter((e) => e.typeId === typeFilter)
      : vehicle?.logEntries ?? [];

  async function handleInitiateTransfer(recipientEmail: string): Promise<void> {
    const transfer = await initiateTransfer(vehicleId, recipientEmail);
    setVehicle((prev) =>
      prev
        ? {
            ...prev,
            transferPending: true,
            pendingTransfer: { recipientEmail: transfer.recipientEmail, expiresAt: transfer.expiresAt },
          }
        : null,
    );
    setTransferDialogOpen(false);
  }

  async function handleCancelTransfer(): Promise<void> {
    await cancelTransfer(vehicleId);
    setVehicle((prev) =>
      prev ? { ...prev, transferPending: false, pendingTransfer: null } : null,
    );
    setCancelTransferDialogOpen(false);
  }

  return {
    vehicleId,
    loadState,
    vehicle,
    displayName,
    typeFilter,
    setTypeFilter,
    filteredEntries,
    insuranceOpen,
    insuranceEditMode,
    openInsurance,
    closeInsurance: () => setInsuranceOpen(false),
    handleInsuranceSave,
    retry: () => setRetryCount((c) => c + 1),
    transferDialogOpen,
    openTransferDialog: () => setTransferDialogOpen(true),
    closeTransferDialog: () => setTransferDialogOpen(false),
    handleInitiateTransfer,
    cancelTransferDialogOpen,
    openCancelTransferDialog: () => setCancelTransferDialogOpen(true),
    closeCancelTransferDialog: () => setCancelTransferDialogOpen(false),
    handleCancelTransfer,
  };
}
