"use client";

import { useState, type ChangeEvent } from "react";
import {
  MAX_IMAGE_BYTES,
  MAX_MEDIA_FILES,
  MAX_VIDEO_BYTES,
  itemsGrandTotal,
  type LogEntryFormState,
  type LogItemDraft,
  type MediaDraft,
} from "@/model/logEntryDraft";

export interface LogEntryFormViewModel {
  canSave: boolean;
  total: string | null;
  mediaError: string | null;
  canAttachMore: boolean;
  setField: <K extends keyof LogEntryFormState>(key: K, value: LogEntryFormState[K]) => void;
  addItem: () => void;
  updateItem: (id: string, patch: Partial<LogItemDraft>) => void;
  removeItem: (id: string) => void;
  /** Validates picked files and appends accepted ones; pass the input element so it resets for re-picking. */
  handleFileChange: (e: ChangeEvent<HTMLInputElement>, fileInput: HTMLInputElement | null) => void;
  removeMedia: (id: string) => void;
  updateCaption: (id: string, caption: string) => void;
}

export function useLogEntryFormViewModel(
  state: LogEntryFormState,
  onChange: (next: LogEntryFormState) => void,
  isSaving: boolean,
): LogEntryFormViewModel {
  const [mediaError, setMediaError] = useState<string | null>(null);

  const canSave = state.typeId.length > 0 && state.title.trim().length > 0 && !isSaving;

  function setField<K extends keyof LogEntryFormState>(key: K, value: LogEntryFormState[K]) {
    onChange({ ...state, [key]: value });
  }

  function addItem() {
    const newItem: LogItemDraft = {
      id: crypto.randomUUID(),
      categoryId: "PART",
      description: "",
      quantity: "",
      unitCost: "",
    };
    onChange({ ...state, items: [...state.items, newItem] });
  }

  function updateItem(id: string, patch: Partial<LogItemDraft>) {
    onChange({
      ...state,
      items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  function removeItem(id: string) {
    onChange({ ...state, items: state.items.filter((item) => item.id !== id) });
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>, fileInput: HTMLInputElement | null) {
    setMediaError(null);
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    if (state.mediaDrafts.length + files.length > MAX_MEDIA_FILES) {
      setMediaError(`Maximum ${MAX_MEDIA_FILES} files allowed`);
      return;
    }

    const newDrafts: MediaDraft[] = [];
    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > maxBytes) {
        const limit = isVideo ? "100 MB" : "10 MB";
        setMediaError(`"${file.name}" exceeds the ${limit} limit`);
        continue;
      }
      newDrafts.push({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        caption: "",
      });
    }

    onChange({ ...state, mediaDrafts: [...state.mediaDrafts, ...newDrafts] });
    // reset so the same file can be picked again
    if (fileInput) fileInput.value = "";
  }

  function removeMedia(id: string) {
    const draft = state.mediaDrafts.find((m) => m.id === id);
    if (draft) URL.revokeObjectURL(draft.url);
    onChange({ ...state, mediaDrafts: state.mediaDrafts.filter((m) => m.id !== id) });
  }

  function updateCaption(id: string, caption: string) {
    onChange({
      ...state,
      mediaDrafts: state.mediaDrafts.map((m) => (m.id === id ? { ...m, caption } : m)),
    });
  }

  return {
    canSave,
    total: itemsGrandTotal(state.items),
    mediaError,
    canAttachMore: state.mediaDrafts.length < MAX_MEDIA_FILES,
    setField,
    addItem,
    updateItem,
    removeItem,
    handleFileChange,
    removeMedia,
    updateCaption,
  };
}
