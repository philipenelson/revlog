import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { createVehicleSchema } from '@maintenance-log/domain';
import { useDatabase } from '@/application/providers/DatabaseProvider';

type LoadState = 'loading' | 'not-found' | 'ready';

// Plain strings, not react-hook-form + zodResolver<CreateVehicleInput>: the
// schema's nickname field transforms "" -> null, which makes the schema's
// input and output types diverge and fights RHF's single generic. Mirrors
// the web Edit Vehicle screen's VehicleDraft approach instead — validated on
// submit via createVehicleSchema.safeParse(), the same schema the API uses.
// See docs/specs/mobile-app/vehicle.md's Decisions.
export interface VehicleFormFields {
  nickname: string;
  make: string;
  model: string;
  year: string;
  mileage: string;
}

export type VehicleFormErrors = Partial<Record<keyof VehicleFormFields, string>>;

const EMPTY_FIELDS: VehicleFormFields = { nickname: '', make: '', model: '', year: '', mileage: '' };

export interface EditVehicleViewModel {
  loadState: LoadState;
  vehicleDisplayName: string;
  fields: VehicleFormFields;
  errors: VehicleFormErrors;
  updateField: (field: keyof VehicleFormFields, value: string) => void;
  isSubmitting: boolean;
  submitError: string | null;
  submit: () => void;
  onCancel: () => void;
  onBackToGarage: () => void;
}

export function useEditVehicleViewModel(): EditVehicleViewModel {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { vehicleRepository } = useDatabase();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [vehicleDisplayName, setVehicleDisplayName] = useState('');
  const [fields, setFields] = useState<VehicleFormFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleRepository || !vehicleId) return;
    void vehicleRepository.findById(vehicleId).then((vehicle) => {
      if (!vehicle) {
        setLoadState('not-found');
        return;
      }
      setFields({
        nickname: vehicle.nickname ?? '',
        make: vehicle.make,
        model: vehicle.model,
        year: String(vehicle.year),
        mileage: String(vehicle.mileage),
      });
      setVehicleDisplayName(vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`);
      setLoadState('ready');
    });
  }, [vehicleRepository, vehicleId]);

  function updateField(field: keyof VehicleFormFields, value: string): void {
    setFields((f) => ({ ...f, [field]: value }));
    setErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
  }

  async function handleSubmit(): Promise<void> {
    if (!vehicleRepository || !vehicleId) return;

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
      await vehicleRepository.update(vehicleId, result.data);
      // back(), not push(`/garage/${vehicleId}`) -- this screen was reached
      // by pushing from Vehicle Detail, so push()ing the same route again
      // stacked a second instance on top instead of returning to the first,
      // leaving this screen itself sandwiched in the stack. Detail's
      // useFocusEffect (see useVehicleDetailViewModel.ts) re-reads on
      // return, so back() still shows the just-saved values.
      router.back();
    } catch {
      setSubmitError("Couldn't save changes. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    loadState,
    vehicleDisplayName,
    fields,
    errors,
    updateField,
    isSubmitting,
    submitError,
    submit: () => void handleSubmit(),
    onCancel: () => router.back(),
    onBackToGarage: () => router.push('/garage'),
  };
}
