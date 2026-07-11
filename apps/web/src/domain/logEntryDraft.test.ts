import { describe, it, expect } from "vitest";
import {
  canSaveLogEntry,
  classifyMediaFiles,
  emptyLogEntryFormState,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from "./logEntryDraft";

// classifyMediaFiles only reads name/type/size, so File-likes suffice (avoids
// allocating real multi-MB blobs).
const img = (name: string, size: number) => ({ name, type: "image/jpeg", size }) as File;
const vid = (name: string, size: number) => ({ name, type: "video/mp4", size }) as File;

describe("logEntryDraft — canSaveLogEntry", () => {
  const base = () => ({ ...emptyLogEntryFormState(), typeId: "SERVICE", title: "Oil change" });

  it("is true with a type and non-blank title and no save in flight", () => {
    expect(canSaveLogEntry(base(), false)).toBe(true);
  });
  it("is false without a type", () => {
    expect(canSaveLogEntry({ ...base(), typeId: "" }, false)).toBe(false);
  });
  it("is false with a blank title", () => {
    expect(canSaveLogEntry({ ...base(), title: "   " }, false)).toBe(false);
  });
  it("is false while saving", () => {
    expect(canSaveLogEntry(base(), true)).toBe(false);
  });
});

describe("logEntryDraft — classifyMediaFiles", () => {
  it("accepts files within the count and size limits", () => {
    const files = [img("a.jpg", 1000), vid("b.mp4", 2000)];
    expect(classifyMediaFiles(0, files)).toEqual({ acceptedFiles: files, error: null });
  });

  it("rejects the whole batch when it would exceed the file count", () => {
    const files = [img("a.jpg", 1), img("b.jpg", 1)];
    expect(classifyMediaFiles(9, files)).toEqual({ acceptedFiles: [], error: "Maximum 10 files allowed" });
  });

  it("skips an oversize image but keeps the valid ones, reporting the violation", () => {
    const ok = img("ok.jpg", 1000);
    const big = img("big.jpg", MAX_IMAGE_BYTES + 1);
    const result = classifyMediaFiles(0, [ok, big]);
    expect(result.acceptedFiles).toEqual([ok]);
    expect(result.error).toBe('"big.jpg" exceeds the 10 MB limit');
  });

  it("uses the 100 MB limit for videos", () => {
    const big = vid("big.mp4", MAX_VIDEO_BYTES + 1);
    expect(classifyMediaFiles(0, [big])).toEqual({
      acceptedFiles: [],
      error: '"big.mp4" exceeds the 100 MB limit',
    });
  });
});
