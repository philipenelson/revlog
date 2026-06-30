import type { MediaRef, MediaStore } from "@/infrastructure/media/MediaStore";
import { todayIso } from "@/utils/date";
import type { LogEntryDetail, LogEntryPayload } from "@maintenance-log/api-client";

/* ── Draft types ────────────────────────────────────────────────── */

export interface LogItemDraft {
  id: string; // local key
  categoryId: string;
  description: string;
  quantity: string;
  unitCost: string;
}

export interface MediaDraft {
  id: string; // local key
  file: File;
  url: string;
  caption: string;
  savedRef?: MediaRef; // set after mediaStore.save()
}

export interface LogEntryFormState {
  typeId: string;
  title: string;
  date: string;
  time: string;
  mileage: string;
  notes: string;
  items: LogItemDraft[];
  mediaDrafts: MediaDraft[];
}

/* ── Limits ─────────────────────────────────────────────────────── */

export const MAX_MEDIA_FILES = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

/* ── Construction ───────────────────────────────────────────────── */

export function emptyLogEntryFormState(): LogEntryFormState {
  return {
    typeId: "",
    title: "",
    date: todayIso(),
    time: "",
    mileage: "",
    notes: "",
    items: [],
    mediaDrafts: [],
  };
}

export function entryToFormState(entry: LogEntryDetail): LogEntryFormState {
  const items: LogItemDraft[] = entry.items.map((item) => ({
    id: item.id,
    categoryId: item.categoryId,
    description: item.description,
    quantity: item.quantity ?? "",
    unitCost: item.unitCost ?? "",
  }));
  return {
    typeId: entry.typeId,
    title: entry.title,
    date: entry.date,
    time: entry.time ?? "",
    mileage: entry.mileage != null ? String(entry.mileage) : "",
    notes: entry.notes ?? "",
    items,
    mediaDrafts: [], // existing server media shown separately; new files only in drafts
  };
}

/* ── Totals ─────────────────────────────────────────────────────── */

export function itemRowTotal(item: LogItemDraft): string | null {
  const q = parseFloat(item.quantity);
  const u = parseFloat(item.unitCost);
  if (!isNaN(q) && !isNaN(u)) return (q * u).toFixed(2);
  return null;
}

export function itemsGrandTotal(items: LogItemDraft[]): string | null {
  let sum = 0;
  let hasAny = false;
  for (const item of items) {
    const t = itemRowTotal(item);
    if (t !== null) {
      sum += parseFloat(t);
      hasAny = true;
    }
  }
  return hasAny ? sum.toFixed(2) : null;
}

/* ── Payload mapping ────────────────────────────────────────────── */

export interface SavedMediaDraft {
  ref: MediaRef;
  caption: string;
}

/**
 * Maps the form draft to the API payload. Pass `media: null` to omit the
 * media field entirely (the edit flow only sends media when new files were
 * attached); pass an array (possibly empty) to always include it.
 */
export function buildLogEntryPayload(
  state: LogEntryFormState,
  media: SavedMediaDraft[] | null,
): LogEntryPayload {
  const payload: LogEntryPayload = {
    typeId: state.typeId,
    title: state.title.trim(),
    date: state.date,
    time: state.time.trim() || null,
    mileage: state.mileage ? parseInt(state.mileage, 10) : null,
    notes: state.notes.trim() || null,
    items: state.items
      .filter((i) => i.description.trim())
      .map((i, idx) => ({
        categoryId: i.categoryId,
        description: i.description.trim(),
        quantity: i.quantity ? parseFloat(i.quantity) : null,
        unitCost: i.unitCost ? parseFloat(i.unitCost) : null,
        sortOrder: idx,
      })),
  };

  if (media) {
    payload.media = media.map((m, idx) => ({
      path: m.ref.path,
      mediaType: m.ref.mediaType,
      caption: m.caption.trim() || null,
      sortOrder: idx,
    }));
  }

  return payload;
}

/** Persists any unsaved media drafts to the MediaStore, keyed by `localEntryId`. */
export function saveDraftMedia(
  mediaStore: MediaStore,
  localEntryId: string,
  drafts: MediaDraft[],
): Promise<SavedMediaDraft[]> {
  return Promise.all(
    drafts.map(async (draft) => {
      if (draft.savedRef) {
        return { ref: draft.savedRef, caption: draft.caption };
      }
      const ref = await mediaStore.save(localEntryId, draft.file);
      return { ref, caption: draft.caption };
    }),
  );
}
