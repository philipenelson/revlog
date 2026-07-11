import { useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { createVehicleSchema } from '@maintenance-log/contracts';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import type { PickedPhoto } from '@/domain/ports/PhotoStore';
import { buildVehicleParseInput, collectFieldErrors } from '@/domain/vehicleForm';

// Plain strings, not react-hook-form + zodResolver<CreateVehicleInput> — same
// reasoning as Edit Vehicle's VehicleFormFields (the schema's nickname
// transform makes its input/output types diverge). Validated on submit via
// createVehicleSchema.safeParse(), the same schema the API uses. See
// docs/specs/mobile-app/vehicle.md's Decisions.
export interface VehicleFormFields {
  nickname: string;
  make: string;
  model: string;
  year: string;
  mileage: string;
}

export type VehicleFormErrors = Partial<Record<keyof VehicleFormFields, string>>;

const EMPTY_FIELDS: VehicleFormFields = { nickname: '', make: '', model: '', year: '', mileage: '' };

export interface AddVehicleViewModel {
  fields: VehicleFormFields;
  errors: VehicleFormErrors;
  updateField: (field: keyof VehicleFormFields, value: string) => void;
  photoPreviewUri: string | null;
  photoError: string | null;
  pickPhoto: () => void;
  removePhoto: () => void;
  isSubmitting: boolean;
  submitError: string | null;
  submit: () => void;
  onCancel: () => void;
}

export function useAddVehicleViewModel(): AddVehicleViewModel {
  const { vehicleRepository } = useDatabase();
  const [fields, setFields] = useState<VehicleFormFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateField(field: keyof VehicleFormFields, value: string): void {
    setFields((f) => ({ ...f, [field]: value }));
    setErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
  }

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

  async function handleSubmit(): Promise<void> {
    if (!vehicleRepository) return;

    const result = createVehicleSchema.safeParse(buildVehicleParseInput(fields));

    if (!result.success) {
      setErrors(collectFieldErrors(result.error.issues) as VehicleFormErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const id = await vehicleRepository.create(result.data, photo ?? undefined);
      // replace(), not push() -- Add Vehicle was itself reached by pushing
      // from Garage, so replacing it means the new Vehicle's Detail screen
      // takes its place in the stack: a single back() from Detail returns
      // to Garage, not to a stale, already-submitted Add form.
      router.replace(`/garage/${id}`);
    } catch {
      setSubmitError("Couldn't save your vehicle. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    fields,
    errors,
    updateField,
    photoPreviewUri: photo?.uri ?? null,
    photoError,
    pickPhoto: () => void handlePickPhoto(),
    removePhoto,
    isSubmitting,
    submitError,
    submit: () => void handleSubmit(),
    onCancel: () => router.back(),
  };
}
