"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getVehicle,
  saveInsurance,
  initiateTransfer,
  cancelTransfer,
  type InsuranceInput,
  type LogEntrySummary,
  type VehicleDetail,
} from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { vehicleDisplayName } from "@/domain/types";
import { logger } from "@/adapters/logging/logger";
import { classifyVehicleLoadError } from "@/domain/vehicleForm";

// The log entries shown for the active type filter: "ALL" shows everything,
// otherwise only entries of that type. Deterministic given the inputs.
export function filterLogEntries(entries: LogEntrySummary[], typeFilter: string): LogEntrySummary[] {
  return typeFilter === "ALL" ? entries : entries.filter((e) => e.typeId === typeFilter);
}

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
  shareReportOpen: boolean;
  openShareReport: () => void;
  closeShareReport: () => void;
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
  const [shareReportOpen, setShareReportOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [cancelTransferDialogOpen, setCancelTransferDialogOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    getVehicle(cookieHttpClient, vehicleId)
      .then((v) => {
        setVehicle(v);
        setLoadState("loaded");
      })
      .catch((err) => {
        const outcome = classifyVehicleLoadError(err);
        if (outcome === "error") logger.error("failed to load vehicle detail", { err });
        setLoadState(outcome);
      });
  }, [vehicleId, retryCount]);

  function openInsurance(editMode: boolean) {
    setInsuranceEditMode(editMode);
    setInsuranceOpen(true);
  }

  async function handleInsuranceSave(input: InsuranceInput): Promise<void> {
    const insurance = await saveInsurance(cookieHttpClient, vehicleId, input);
    setVehicle((prev) => (prev ? { ...prev, insurance } : null));
  }

  const displayName = vehicle ? vehicleDisplayName(vehicle) : "Vehicle";

  const filteredEntries = filterLogEntries(vehicle?.logEntries ?? [], typeFilter);

  async function handleInitiateTransfer(recipientEmail: string): Promise<void> {
    const transfer = await initiateTransfer(cookieHttpClient, vehicleId, recipientEmail);
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
    await cancelTransfer(cookieHttpClient, vehicleId);
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
    shareReportOpen,
    openShareReport: () => setShareReportOpen(true),
    closeShareReport: () => setShareReportOpen(false),
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
