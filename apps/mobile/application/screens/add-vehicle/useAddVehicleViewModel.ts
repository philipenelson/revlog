import { useState } from 'react';
import { router } from 'expo-router';
import { createVehicleSchema } from '@maintenance-log/domain';
import { useDatabase } from '@/application/providers/DatabaseProvider';

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
  isSubmitting: boolean;
  submitError: string | null;
  submit: () => void;
  onCancel: () => void;
}

export function useAddVehicleViewModel(): AddVehicleViewModel {
  const { vehicleRepository } = useDatabase();
  const [fields, setFields] = useState<VehicleFormFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateField(field: keyof VehicleFormFields, value: string): void {
    setFields((f) => ({ ...f, [field]: value }));
    setErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
  }

  async function handleSubmit(): Promise<void> {
    if (!vehicleRepository) return;

    const result = createVehicleSchema.safeParse({
      nickname: fields.nickname,
      make: fields.make,
      model: fields.model,
      year: fields.year,
      // Defensive, matches the web draft validator: an Owner may type
      // "12,500" into the mileage field even though it's never pre-filled
      // with commas.
      mileage: fields.mileage.replace(/,/g, ''),
    });

    if (!result.success) {
      const nextErrors: VehicleFormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !(field in nextErrors)) {
          nextErrors[field as keyof VehicleFormFields] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const id = await vehicleRepository.create(result.data);
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
    isSubmitting,
    submitError,
    submit: () => void handleSubmit(),
    onCancel: () => router.back(),
  };
}
