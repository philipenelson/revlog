'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useMediaStore } from '@/lib/media/useMediaStore';
import {
  LogEntryForm,
  emptyFormState,
  type LogEntryFormState,
  type MediaDraft,
} from '../LogEntryForm';

export default function NewLogEntryPage() {
  const router = useRouter();
  const params = useParams<{ vehicleId: string }>();
  const vehicleId = params.vehicleId;
  const { session } = useAuth();
  const mediaStore = useMediaStore();

  const [formState, setFormState] = useState<LogEntryFormState>(emptyFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Use a stable local ID for OPFS media grouping before the real entry ID is known
  const localEntryIdRef = useRef(crypto.randomUUID());

  async function handleSave() {
    if (!session) return;
    setIsSaving(true);
    setError(null);

    try {
      // Save media files to OPFS first
      const savedMedia = await saveMediaToOpfs(formState.mediaDrafts);

      const body = {
        typeId: formState.typeId,
        title: formState.title.trim(),
        date: formState.date,
        time: formState.time.trim() || null,
        mileage: formState.mileage ? parseInt(formState.mileage, 10) : null,
        notes: formState.notes.trim() || null,
        items: formState.items
          .filter((i) => i.description.trim())
          .map((i, idx) => ({
            categoryId: i.categoryId,
            description: i.description.trim(),
            quantity: i.quantity ? parseFloat(i.quantity) : null,
            unitCost: i.unitCost ? parseFloat(i.unitCost) : null,
            sortOrder: idx,
          })),
        media: savedMedia.map((m, idx) => ({
          path: m.ref.path,
          mediaType: m.ref.mediaType,
          caption: m.caption.trim() || null,
          sortOrder: idx,
        })),
      };

      await apiFetch(`/vehicles/${vehicleId}/log`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify(body),
      });

      router.push(`/garage/${vehicleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveMediaToOpfs(drafts: MediaDraft[]) {
    const localId = localEntryIdRef.current;
    return Promise.all(
      drafts.map(async (draft) => {
        if (draft.savedRef) {
          return { ref: draft.savedRef, caption: draft.caption };
        }
        const ref = await mediaStore.save(localId, draft.file);
        return { ref, caption: draft.caption };
      }),
    );
  }

  return (
    <LogEntryForm
      vehicleId={vehicleId}
      mode="create"
      state={formState}
      onChange={setFormState}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
    />
  );
}
