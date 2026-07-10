"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createVehicle, createVehicleWithPhoto, skipOnboarding } from "@maintenance-log/api-client";
import { cookieHttpClient } from "@/adapters/http/CookieHttpClient";
import { validateVehicleDraft } from "@/domain/validation/vehicleDraft";
import type { VehicleDraft, VehicleDraftErrors } from "@/domain/types";
import { logger } from "@/adapters/logging/logger";
import { readFileAsDataUrl } from "@/utils/file";
import { sessionStore } from '@/adapters/session/sessionStore';

export type OnboardingStep = 1 | 2 | 3;

const EMPTY_DRAFT: VehicleDraft = { nickname: "", make: "", model: "", year: "", mileage: "" };

const VEHICLE_SAVE_ERROR = "Couldn't save your vehicle. Check the details and try again.";
const SKIP_ERROR = "Couldn't skip onboarding right now. Try again in a moment.";
const SERVICE_ERROR = "We stalled. Our mechanics are on it — try again in a moment.";

export interface OnboardingViewModel {
  step: OnboardingStep;
  goToVehicleStep: () => void;
  goBackToWelcome: () => void;
  draft: VehicleDraft;
  errors: VehicleDraftErrors;
  updateField: (field: keyof VehicleDraft) => (e: ChangeEvent<HTMLInputElement>) => void;
  photoPreviewUrl: string | null;
  handlePhotoChange: (e: ChangeEvent<HTMLInputElement>) => void;
  removePhoto: (fileInput: HTMLInputElement | null) => void;
  /** The draft as saved — drives the step-3 summary plate. */
  vehicle: VehicleDraft | null;
  readyHeadline: string;
  submitting: boolean;
  vehicleError: string | null;
  handleContinue: (e: FormEvent) => Promise<void>;
  skipping: boolean;
  skipError: string | null;
  handleSkip: () => Promise<void>;
  goToGarage: () => void;
}

export function useOnboardingViewModel(): OnboardingViewModel {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [draft, setDraft] = useState<VehicleDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<VehicleDraftErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<VehicleDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);

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

  function activateAccount() {
    const session = sessionStore.getSession();
    if (session) {
      sessionStore.setSession({
        ...session,
        account: {
          ...session.account,
          status: 'ACTIVE'
        }
      });
    }
  }

  async function handleContinue(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validateVehicleDraft(draft, { enforceYearRange: false });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setVehicleError(null);
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
      activateAccount();
      setVehicle({ ...draft });
      setStep(3);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setVehicleError(VEHICLE_SAVE_ERROR);
      } else {
        logger.error("vehicle creation failed during onboarding", { err });
        setVehicleError(SERVICE_ERROR);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    setSkipError(null);
    setSkipping(true);
    try {
      await skipOnboarding(cookieHttpClient);
      activateAccount();
      router.push("/garage");
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setSkipError(SKIP_ERROR);
      } else {
        logger.error("skip onboarding failed", { err });
        setSkipError(SERVICE_ERROR);
      }
    } finally {
      setSkipping(false);
    }
  }

  const readyHeadline = vehicle
    ? `${vehicle.nickname.trim() || `${vehicle.make.trim()} ${vehicle.model.trim()}`.trim()} is in your garage`
    : "";

  return {
    step,
    goToVehicleStep: () => setStep(2),
    goBackToWelcome: () => setStep(1),
    draft,
    errors,
    updateField,
    photoPreviewUrl,
    handlePhotoChange,
    removePhoto,
    vehicle,
    readyHeadline,
    submitting,
    vehicleError,
    handleContinue,
    skipping,
    skipError,
    handleSkip,
    goToGarage: () => router.push("/garage"),
  };
}
