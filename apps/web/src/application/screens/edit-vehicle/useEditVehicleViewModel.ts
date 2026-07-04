"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError, getVehicle, updateVehicle, setVehiclePhoto, deleteVehicle } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/infrastructure/http/CookieHttpClient";
import { validateVehicleDraft } from "@/domain/validation/vehicleDraft";
import type { VehicleDraft, VehicleDraftErrors } from "@/domain/types";
import { logger } from "@/infrastructure/logging/logger";
import { readFileAsDataUrl } from "@/utils/file";

export type EditVehicleLoadState = "loading" | "ready" | "not-found" | "error";

export interface EditVehicleViewModel {
  vehicleId: string;
  loadState: EditVehicleLoadState;
  vehicleDisplayName: string;
  fields: VehicleDraft;
  errors: VehicleDraftErrors;
  updateField: (field: keyof VehicleDraft) => (e: ChangeEvent<HTMLInputElement>) => void;
  /** The saved photo if no replacement has been picked yet, else a local preview of the pending pick. */
  photoPreviewUrl: string | null;
  /** True only while a not-yet-saved replacement is pending — governs whether the remove-selection control is shown. */
  hasPendingPhotoPick: boolean;
  handlePhotoChange: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Discards the pending photo pick, reverting to the currently-saved photo; pass the file input so its value resets too. */
  removePhoto: (fileInput: HTMLInputElement | null) => void;
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
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pickedPhotoPreviewUrl, setPickedPhotoPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleId) return;
    getVehicle(cookieHttpClient, vehicleId)
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
        setSavedPhotoUrl(vehicle.photoUrl);
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

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPhotoFile(file);
    readFileAsDataUrl(file).then(setPickedPhotoPreviewUrl);
  }

  function removePhoto(fileInput: HTMLInputElement | null) {
    setPhotoFile(null);
    setPickedPhotoPreviewUrl(null);
    if (fileInput) fileInput.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validateVehicleDraft(fields, { enforceYearRange: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);

    try {
      await updateVehicle(cookieHttpClient, vehicleId, {
        nickname: fields.nickname.trim() || null,
        make: fields.make.trim(),
        model: fields.model.trim(),
        year: Number(fields.year.trim()),
        mileage: Number(fields.mileage.trim().replace(/,/g, "")),
      });
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setSubmitError("Couldn't save changes. Check the details and try again.");
      } else {
        logger.error("failed to update vehicle", { err });
        setSubmitError("We stalled. Our mechanics are on it — try again in a moment.");
      }
      setSubmitting(false);
      return;
    }

    if (photoFile) {
      try {
        await setVehiclePhoto(cookieHttpClient, vehicleId, photoFile);
      } catch (err) {
        logger.error("failed to upload vehicle photo", { err });
        setSubmitError("Details saved, but the photo couldn't be uploaded. Try again.");
        setSubmitting(false);
        return;
      }
    }

    router.push(`/garage/${vehicleId}`);
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
      await deleteVehicle(cookieHttpClient, vehicleId);
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
    photoPreviewUrl: pickedPhotoPreviewUrl ?? savedPhotoUrl,
    hasPendingPhotoPick: pickedPhotoPreviewUrl !== null,
    handlePhotoChange,
    removePhoto,
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
