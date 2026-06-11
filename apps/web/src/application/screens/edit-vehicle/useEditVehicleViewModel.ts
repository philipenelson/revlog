"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/application/providers/AuthProvider";
import { ApiError } from "@/model/errors";
import { getVehicle, updateVehicle } from "@/model/services/vehicleService";
import { validateVehicleDraft } from "@/model/validation/vehicleDraft";
import type { VehicleDraft, VehicleDraftErrors } from "@/model/types";
import { logger } from "@/infrastructure/logging/logger";

export type EditVehicleLoadState = "loading" | "ready" | "not-found" | "error";

export interface EditVehicleViewModel {
  vehicleId: string;
  loadState: EditVehicleLoadState;
  fields: VehicleDraft;
  errors: VehicleDraftErrors;
  updateField: (field: keyof VehicleDraft) => (e: ChangeEvent<HTMLInputElement>) => void;
  submitting: boolean;
  submitError: string | null;
  handleSubmit: (e: FormEvent) => Promise<void>;
}

export function useEditVehicleViewModel(): EditVehicleViewModel {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [loadState, setLoadState] = useState<EditVehicleLoadState>("loading");
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

  useEffect(() => {
    if (!session || !vehicleId) return;
    getVehicle(session.accessToken, vehicleId)
      .then((vehicle) => {
        setFields({
          nickname: vehicle.nickname ?? "",
          make: vehicle.make,
          model: vehicle.model,
          year: String(vehicle.year),
          mileage: String(vehicle.mileage),
        });
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
  }, [session, vehicleId]);

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

    if (!session) {
      setSubmitError("You are not signed in. Please sign in and try again.");
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      await updateVehicle(session.accessToken, vehicleId, {
        nickname: fields.nickname.trim() || null,
        make: fields.make.trim(),
        model: fields.model.trim(),
        year: Number(fields.year.trim()),
        mileage: Number(fields.mileage.trim().replace(/,/g, "")),
      });
      router.push(`/garage/${vehicleId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setSubmitError("Couldn’t save changes. Check the details and try again.");
      } else {
        logger.error("failed to update vehicle", { err });
        setSubmitError("We stalled. Our mechanics are on it — try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return {
    vehicleId,
    loadState,
    fields,
    errors,
    updateField,
    submitting,
    submitError,
    handleSubmit,
  };
}
