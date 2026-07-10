"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createVehicle, createVehicleWithPhoto } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { validateVehicleDraft } from "@/domain/validation/vehicleDraft";
import type { VehicleDraft, VehicleDraftErrors } from "@/domain/types";
import { logger } from "@/adapters/logging/logger";
import { readFileAsDataUrl } from "@/utils/file";

const EMPTY_DRAFT: VehicleDraft = { nickname: "", make: "", model: "", year: "", mileage: "" };

export interface AddVehicleViewModel {
  draft: VehicleDraft;
  errors: VehicleDraftErrors;
  updateField: (field: keyof VehicleDraft) => (e: ChangeEvent<HTMLInputElement>) => void;
  photoPreviewUrl: string | null;
  handlePhotoChange: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Clears the selected photo; pass the file input element so its value resets too. */
  removePhoto: (fileInput: HTMLInputElement | null) => void;
  submitting: boolean;
  submitError: string | null;
  handleSubmit: (e: FormEvent) => Promise<void>;
  displayName: string | null;
  isComplete: boolean;
}

export function useAddVehicleViewModel(): AddVehicleViewModel {
  const router = useRouter();

  const [draft, setDraft] = useState<VehicleDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<VehicleDraftErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateField(field: keyof VehicleDraft) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setDraft((d) => ({ ...d, [field]: value }));
      setErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
    };
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPhotoFile(file);
    readFileAsDataUrl(file).then(setPhotoPreviewUrl);
  }

  function removePhoto(fileInput: HTMLInputElement | null) {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (fileInput) fileInput.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validateVehicleDraft(draft, { enforceYearRange: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);

    try {
      const payload = {
        nickname: draft.nickname.trim() || undefined,
        make: draft.make.trim(),
        model: draft.model.trim(),
        year: Number(draft.year.trim()),
        mileage: Number(draft.mileage.trim().replace(/,/g, "")),
      };
      if (photoFile) {
        await createVehicleWithPhoto(cookieHttpClient, payload, photoFile);
      } else {
        await createVehicle(cookieHttpClient, payload);
      }
      router.push("/garage");
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setSubmitError("Couldn't save your vehicle. Check the details and try again.");
      } else {
        logger.error("failed to add vehicle", { err });
        setSubmitError("We stalled. Our mechanics are on it — try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const displayName =
    draft.nickname.trim() ||
    (draft.make.trim() && draft.model.trim() ? `${draft.make.trim()} ${draft.model.trim()}` : null);
  const isComplete = Boolean(
    draft.make.trim() && draft.model.trim() && draft.year.trim() && draft.mileage.trim(),
  );

  return {
    draft,
    errors,
    updateField,
    photoPreviewUrl,
    handlePhotoChange,
    removePhoto,
    submitting,
    submitError,
    handleSubmit,
    displayName,
    isComplete,
  };
}
