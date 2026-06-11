"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/application/providers/AuthProvider";
import { useMediaStore } from "@/infrastructure/media/useMediaStore";
import { getLogEntry, updateLogEntry, deleteLogEntry } from "@/model/services/logEntryService";
import {
  buildLogEntryPayload,
  entryToFormState,
  saveDraftMedia,
  type LogEntryFormState,
} from "@/model/logEntryDraft";

export interface EditLogEntryViewModel {
  vehicleId: string;
  formState: LogEntryFormState | null;
  setFormState: (next: LogEntryFormState) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  handleSave: () => Promise<void>;
  showDeleteConfirm: boolean;
  openDeleteConfirm: () => void;
  closeDeleteConfirm: () => void;
  isDeleting: boolean;
  handleDelete: () => Promise<void>;
}

export function useEditLogEntryViewModel(): EditLogEntryViewModel {
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
        setError(err instanceof Error ? err.message : "Failed to load log entry");
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
      // Save any new media drafts to OPFS, grouped under the real entry ID
      const savedMedia = await saveDraftMedia(mediaStore, entryId, formState.mediaDrafts);
      const payload = buildLogEntryPayload(formState, savedMedia.length > 0 ? savedMedia : null);
      await updateLogEntry(session.accessToken, vehicleId, entryId, payload);
      router.push(`/garage/${vehicleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again");
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
      setError(err instanceof Error ? err.message : "Failed to delete entry");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return {
    vehicleId,
    formState,
    setFormState,
    isLoading,
    isSaving,
    error,
    handleSave,
    showDeleteConfirm,
    openDeleteConfirm: () => setShowDeleteConfirm(true),
    closeDeleteConfirm: () => setShowDeleteConfirm(false),
    isDeleting,
    handleDelete,
  };
}
