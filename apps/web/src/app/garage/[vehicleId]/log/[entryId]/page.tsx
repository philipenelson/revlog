'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/application/providers/AuthProvider';
import {
  getLogEntry,
  updateLogEntry,
  deleteLogEntry,
  type LogEntryPayload,
} from '@/model/services/logEntryService';
import type { LogEntryDetail } from '@/model/types';
import { useMediaStore } from '@/infrastructure/media/useMediaStore';
import {
  LogEntryForm,
  type LogEntryFormState,
  type LogItemDraft,
  type MediaDraft,
} from '../LogEntryForm';
import styles from '../log-entry.module.css';

function entryToFormState(entry: LogEntryDetail): LogEntryFormState {
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

    getLogEntry(session.accessToken, vehicleId, entryId)
      .then((entry) => {
        if (cancelled) return;
        setFormState(entryToFormState(entry));
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

      const body: LogEntryPayload = {
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
        body.media = savedMedia.map((m, idx) => ({
          path: m.ref.path,
          mediaType: m.ref.mediaType,
          caption: m.caption.trim() || null,
          sortOrder: idx,
        }));
      }

      await updateLogEntry(session.accessToken, vehicleId, entryId, body);

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
      await deleteLogEntry(session.accessToken, vehicleId, entryId);
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
