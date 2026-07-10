import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { initiateTransferSchema } from '@maintenance-log/contracts';
import { useDatabase } from '@/application/providers/DatabaseProvider';

type LoadState = 'loading' | 'not-found' | 'ready';

export interface VehicleTransferViewModel {
  loadState: LoadState;
  vehicleDisplayName: string;
  vehicleSubMeta: string;
  recipientEmail: string;
  updateRecipientEmail: (value: string) => void;
  emailError: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  submit: () => void;
  onCancel: () => void;
}

// UC-MOB-TRANSFER-1. Reached only from Vehicle Detail's [⋮] menu (see
// docs/specs/mobile-app/vehicle.md's Decisions), so a Vehicle with a
// pending transfer already can't get here -- that entry point is disabled.
export function useVehicleTransferViewModel(): VehicleTransferViewModel {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { vehicleRepository } = useDatabase();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [vehicleDisplayName, setVehicleDisplayName] = useState('');
  const [vehicleSubMeta, setVehicleSubMeta] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleRepository || !vehicleId) return;
    void vehicleRepository.findById(vehicleId).then((vehicle) => {
      if (!vehicle) {
        setLoadState('not-found');
        return;
      }
      setVehicleDisplayName(vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`);
      setVehicleSubMeta(`${vehicle.year} ${vehicle.make} ${vehicle.model}`);
      setLoadState('ready');
    });
  }, [vehicleRepository, vehicleId]);

  function updateRecipientEmail(value: string): void {
    setRecipientEmail(value);
    if (emailError) setEmailError(null);
  }

  async function handleSubmit(): Promise<void> {
    if (!vehicleRepository || !vehicleId) return;

    const result = initiateTransferSchema.safeParse({ recipientEmail });
    if (!result.success) {
      setEmailError(result.error.issues[0]?.message ?? 'Enter a valid email address');
      return;
    }

    setEmailError(null);
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await vehicleRepository.initiateTransfer(vehicleId, result.data.recipientEmail);
      // back(), not push() -- this screen was reached by pushing from
      // Vehicle Detail's [⋮] menu; Detail's useFocusEffect re-reads on
      // return, so back() still shows the just-locked state.
      router.back();
    } catch {
      setSubmitError("Couldn't send the transfer. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    loadState,
    vehicleDisplayName,
    vehicleSubMeta,
    recipientEmail,
    updateRecipientEmail,
    emailError,
    isSubmitting,
    submitError,
    submit: () => void handleSubmit(),
    onCancel: () => router.back(),
  };
}
