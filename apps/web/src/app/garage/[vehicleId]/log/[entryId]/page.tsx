'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useMediaStore } from '@/lib/media/useMediaStore';
import {
  LogEntryForm,
  type LogEntryFormState,
  type LogItemDraft,
  type MediaDraft,
} from '../LogEntryForm';
import styles from '../log-entry.module.css';

interface LogEntryResponse {
  logEntry: {
    id: string;
    typeId: string;
    title: string;
    date: string;
    time: string | null;
    mileage: number | null;
    notes: string | null;
    items: Array<{
      id: string;
      categoryId: string;
      description: string;
      quantity: string | null;
      unitCost: string | null;
    }>;
    media: Array<{
      id: string;
      path: string;
      mediaType: 'IMAGE' | 'VIDEO';
      caption: string | null;
    }>;
  };
}

function entryToFormState(entry: LogEntryResponse['logEntry']): LogEntryFormState {
  const items: LogItemDraft[] = entry.items.map((item) => ({
    id: item.id,
    categoryId: item.categoryId,
    description: item.description,
    quantity: item.quantity ?? '',
    unitCost: item.unitCost ?? '',
  }));
  return {
    typeId: entry.typeId,
    title: entry.title,
    date: entry.date,
    time: entry.time ?? '',
    mileage: entry.mileage != null ? String(entry.mileage) : '',
    notes: entry.notes ?? '',
    items,
    mediaDrafts: [], // existing server media shown separately; new files only in drafts
  };
}

export default function EditLogEntryPage() {
  const router = useRouter();
  const params = useParams<{ vehicleId: string; entryId: string }>();
  const { vehicleId, entryId } = params;
  const { session } = useAuth();
  const mediaStore = useMediaStore();

  const [formState, setFormState] = useState<LogEntryFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const localEntryIdRef = useRef(entryId);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    apiFetch<LogEntryResponse>(`/vehicles/${vehicleId}/log/${entryId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((data) => {
        if (cancelled) return;
        setFormState(entryToFormState(data.logEntry));
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load log entry');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, vehicleId, entryId]);

  async function handleSave() {
    if (!session || !formState) return;
    setIsSaving(true);
    setError(null);

    try {
      // Save any new media drafts to OPFS
      const savedMedia = await Promise.all(
        formState.mediaDrafts.map(async (draft: MediaDraft) => {
          if (draft.savedRef) return { ref: draft.savedRef, caption: draft.caption };
          const ref = await mediaStore.save(localEntryIdRef.current, draft.file);
          return { ref, caption: draft.caption };
        }),
      );

      const body: Record<string, unknown> = {
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
      };

      if (savedMedia.length > 0) {
        body['media'] = savedMedia.map((m, idx) => ({
          path: m.ref.path,
          mediaType: m.ref.mediaType,
          caption: m.caption.trim() || null,
          sortOrder: idx,
        }));
      }

      await apiFetch(`/vehicles/${vehicleId}/log/${entryId}`, {
        method: 'PATCH',
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

  async function handleDelete() {
    if (!session) return;
    setIsDeleting(true);

    try {
      await apiFetch(`/vehicles/${vehicleId}/log/${entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      router.push(`/garage/${vehicleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (isLoading) {
    return (
      <div className={styles.scene}>
        <div className={styles.form}>
          <p className={styles.statusText}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!formState) {
    return (
      <div className={styles.scene}>
        <div className={styles.form}>
          <div className={styles.errorBanner} data-testid="load-error">
            {error ?? 'Entry not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <LogEntryForm
        vehicleId={vehicleId}
        mode="edit"
        state={formState}
        onChange={setFormState}
        onSave={handleSave}
        onDelete={() => setShowDeleteConfirm(true)}
        isSaving={isSaving}
        error={error}
      />

      {showDeleteConfirm && (
        <div className={styles.overlay} data-testid="delete-dialog">
          <div className={styles.dialog}>
            <div className={styles.dialogTitle}>Delete this log entry?</div>
            <div className={styles.dialogBody}>
              This cannot be undone. The entry and all its items and media will be permanently removed.
            </div>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                data-testid="cancel-delete-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnConfirmDelete}
                onClick={handleDelete}
                disabled={isDeleting}
                data-testid="confirm-delete-btn"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
