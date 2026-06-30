"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/domain/errors";
import { getVehicle, updateVehicle, deleteVehicle } from "@/domain/services/vehicleService";
import { validateVehicleDraft } from "@/domain/validation/vehicleDraft";
import type { VehicleDraft, VehicleDraftErrors } from "@/domain/types";
import { logger } from "@/infrastructure/logging/logger";

export type EditVehicleLoadState = "loading" | "ready" | "not-found" | "error";

export interface EditVehicleViewModel {
  vehicleId: string;
  loadState: EditVehicleLoadState;
  vehicleDisplayName: string;
  fields: VehicleDraft;
  errors: VehicleDraftErrors;
  updateField: (field: keyof VehicleDraft) => (e: ChangeEvent<HTMLInputElement>) => void;
  submitting: boolean;
  submitError: string | null;
  handleSubmit: (e: FormEvent) => Promise<void>;
  deleteDialogOpen: boolean;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  deleting: boolean;
  deleteError: string | null;
  handleDelete: () => Promise<void>;
}

export function useEditVehicleViewModel(): EditVehicleViewModel {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const router = useRouter();

  const [loadState, setLoadState] = useState<EditVehicleLoadState>("loading");
  const [vehicleDisplayName, setVehicleDisplayName] = useState("");
  const [fields, setFields] = useState<VehicleDraft>({
    nickname: "",
    make: "",
    model: "",
    year: "",
    mileage: "",
  });
  const [errors, setErrors] = useState<VehicleDraftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleId) return;
    getVehicle(vehicleId)
      .then((vehicle) => {
        setFields({
          nickname: vehicle.nickname ?? "",
          make: vehicle.make,
          model: vehicle.model,
          year: String(vehicle.year),
          mileage: String(vehicle.mileage),
        });
        setVehicleDisplayName(
          vehicle.nickname || `${vehicle.make} ${vehicle.model}`,
        );
        setLoadState("ready");
      })
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setLoadState("not-found");
        } else {
          logger.error("failed to load vehicle for edit", { err });
          setLoadState("error");
        }
      });
  }, [vehicleId]);

  function updateField(field: keyof VehicleDraft) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setFields((f) => ({ ...f, [field]: value }));
      setErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validateVehicleDraft(fields, { enforceYearRange: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);

    try {
      await updateVehicle(vehicleId, {
        nickname: fields.nickname.trim() || null,
        make: fields.make.trim(),
        model: fields.model.trim(),
        year: Number(fields.year.trim()),
        mileage: Number(fields.mileage.trim().replace(/,/g, "")),
      });
      router.push(`/garage/${vehicleId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setSubmitError("Couldn't save changes. Check the details and try again.");
      } else {
        logger.error("failed to update vehicle", { err });
        setSubmitError("We stalled. Our mechanics are on it — try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function openDeleteDialog() {
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteDialogOpen(false);
    setDeleteError(null);
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteVehicle(vehicleId);
      router.push("/garage");
    } catch (err) {
      logger.error("failed to delete vehicle", { err });
      setDeleteError("Something went wrong. Try again in a moment.");
    } finally {
      setDeleting(false);
    }
  }

  return {
    vehicleId,
    loadState,
    vehicleDisplayName,
    fields,
    errors,
    updateField,
    submitting,
    submitError,
    handleSubmit,
    deleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    deleting,
    deleteError,
    handleDelete,
  };
}
