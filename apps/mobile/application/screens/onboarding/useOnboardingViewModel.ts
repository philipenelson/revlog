import { useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { createVehicleSchema } from '@maintenance-log/domain';
import { skipOnboarding } from '@maintenance-log/api-client';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import { useAuth } from '@/application/providers/AuthProvider';
import { tokenHttpClient } from '@/adapters/http/TokenHttpClient';
import { logger } from '@/adapters/logging/logger';
import type { PickedPhoto } from '@/domain/ports/PhotoStore';
import { isUserFacingError, SERVICE_ERROR } from '@/domain/apiError';
import { vehicleDisplayLabel, collectFieldErrors } from '@/domain/vehicleForm';

export type OnboardingStep = 1 | 2 | 3;

// Plain strings, validated on submit via createVehicleSchema — the same shape
// and reasoning as the Add Vehicle form (see useAddVehicleViewModel).
export interface VehicleFormFields {
  nickname: string;
  make: string;
  model: string;
  year: string;
  mileage: string;
}

export type VehicleFormErrors = Partial<Record<keyof VehicleFormFields, string>>;

const EMPTY_FIELDS: VehicleFormFields = { nickname: '', make: '', model: '', year: '', mileage: '' };

const VEHICLE_SAVE_ERROR = "Couldn't save your vehicle. Try again in a moment.";
const SKIP_ERROR = "Couldn't skip right now. Try again in a moment.";

export interface OnboardingViewModel {
  step: OnboardingStep;
  goToVehicleStep: () => void;
  goBackToWelcome: () => void;
  fields: VehicleFormFields;
  errors: VehicleFormErrors;
  updateField: (field: keyof VehicleFormFields, value: string) => void;
  photoPreviewUri: string | null;
  photoError: string | null;
  pickPhoto: () => void;
  removePhoto: () => void;
  /** The vehicle as saved — drives the Step 3 spec plate. */
  savedVehicle: VehicleFormFields | null;
  readyHeadline: string;
  isSubmitting: boolean;
  submitError: string | null;
  onContinue: () => void;
  isSkipping: boolean;
  skipError: string | null;
  onSkip: () => void;
  onGoToGarage: () => void;
}

export function useOnboardingViewModel(): OnboardingViewModel {
  const { vehicleRepository } = useDatabase();
  const { resolveOnboarding } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [fields, setFields] = useState<VehicleFormFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [savedVehicle, setSavedVehicle] = useState<VehicleFormFields | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);

  function updateField(field: keyof VehicleFormFields, value: string): void {
    setFields((f) => ({ ...f, [field]: value }));
    setErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
  }

  // Photo is optional (same picker path as the Add Vehicle screen). Denied
  // permission surfaces an inline hint rather than blocking the wizard.
  async function handlePickPhoto(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Enable photo access in Settings to add a picture of your vehicle.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0]!;
    setPhotoError(null);
    setPhoto({ uri: asset.uri, name: asset.fileName ?? 'vehicle-photo.jpg', type: asset.mimeType ?? 'image/jpeg' });
  }

  function removePhoto(): void {
    setPhoto(null);
    setPhotoError(null);
  }

  // Complete onboarding by adding the first Vehicle. Offline-first: the write
  // goes through the repository (SQLite + outbox), never a direct POST — so the
  // Garage can read it offline afterward. The Account is flipped to ACTIVE
  // optimistically; the server confirms when the outbox flushes POST /vehicles.
  async function handleContinue(): Promise<void> {
    if (!vehicleRepository) return;

    const result = createVehicleSchema.safeParse({
      nickname: fields.nickname,
      make: fields.make,
      model: fields.model,
      year: fields.year,
      // Defensive, matches Add Vehicle: an Owner may type "12,500".
      mileage: fields.mileage.replace(/,/g, ''),
    });

    if (!result.success) {
      setErrors(collectFieldErrors(result.error.issues) as VehicleFormErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await vehicleRepository.create(result.data, photo ?? undefined);
      resolveOnboarding();
      setSavedVehicle({ ...fields });
      setStep(3);
    } catch {
      setSubmitError(VEHICLE_SAVE_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Skip is an online-only op never persisted locally — call the service
  // directly with tokenHttpClient (mobile CLAUDE.md; ADR 0036). The server
  // transitions the Account to ACTIVE (ADR 0015); flip in memory and route out.
  async function handleSkip(): Promise<void> {
    setSkipError(null);
    setIsSkipping(true);
    try {
      await skipOnboarding(tokenHttpClient);
      resolveOnboarding();
      router.replace('/garage');
    } catch (err) {
      if (isUserFacingError(err)) {
        setSkipError(SKIP_ERROR);
      } else {
        logger.error('skip onboarding failed', { err });
        setSkipError(SERVICE_ERROR);
      }
    } finally {
      setIsSkipping(false);
    }
  }

  const readyHeadline = savedVehicle
    ? `${vehicleDisplayLabel(savedVehicle.nickname, savedVehicle.make, savedVehicle.model) ?? ''} is in your garage`
    : '';

  return {
    step,
    goToVehicleStep: () => setStep(2),
    goBackToWelcome: () => setStep(1),
    fields,
    errors,
    updateField,
    photoPreviewUri: photo?.uri ?? null,
    photoError,
    pickPhoto: () => void handlePickPhoto(),
    removePhoto,
    savedVehicle,
    readyHeadline,
    isSubmitting,
    submitError,
    onContinue: () => void handleContinue(),
    isSkipping,
    skipError,
    onSkip: () => void handleSkip(),
    onGoToGarage: () => router.replace('/garage'),
  };
}
