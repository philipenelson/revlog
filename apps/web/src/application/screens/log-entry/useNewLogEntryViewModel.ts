"use client";

import { useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/application/providers/AuthProvider";
import { useMediaStore } from "@/infrastructure/media/useMediaStore";
import { createLogEntry } from "@/model/services/logEntryService";
import {
  buildLogEntryPayload,
  emptyLogEntryFormState,
  saveDraftMedia,
  type LogEntryFormState,
} from "@/model/logEntryDraft";

export interface NewLogEntryViewModel {
  vehicleId: string;
  formState: LogEntryFormState;
  setFormState: (next: LogEntryFormState) => void;
  isSaving: boolean;
  error: string | null;
  handleSave: () => Promise<void>;
}

export function useNewLogEntryViewModel(): NewLogEntryViewModel {
  const router = useRouter();
  const params = useParams<{ vehicleId: string }>();
  const vehicleId = params.vehicleId;
  const { session } = useAuth();
  const mediaStore = useMediaStore();

  const [formState, setFormState] = useState<LogEntryFormState>(emptyLogEntryFormState);
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
      const savedMedia = await saveDraftMedia(mediaStore, localEntryIdRef.current, formState.mediaDrafts);
      await createLogEntry(session.accessToken, vehicleId, buildLogEntryPayload(formState, savedMedia));
      router.push(`/garage/${vehicleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again");
    } finally {
      setIsSaving(false);
    }
  }

  return { vehicleId, formState, setFormState, isSaving, error, handleSave };
}
