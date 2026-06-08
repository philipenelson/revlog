# MediaStore Architecture Spec

**Area:** Garage (cross-cutting client-side infrastructure)
**Status:** Not started
**Last updated:** 2026-06-09

---

## Overview

The Log Entry screen allows Owners to attach photos and videos to their log entries. In V1, these files are stored **locally on the user's device** using the browser's Origin Private File System (OPFS) — no upload to the API server, no cloud storage costs. In V2, a cloud/network adapter replaces the OPFS adapter with no changes to any consuming component.

This document specifies the `MediaStore` interface (Port), its V1 OPFS implementation (Adapter), and the injection mechanism.

---

## Pattern: Port / Adapter

`MediaStore` is a **Port** in hexagonal architecture terms — a TypeScript interface that defines a storage contract the application drives. Implementations are **Adapters** that satisfy the interface without the application caring how.

This is not a Repository. Repositories in this project are paired to domain aggregates (Vehicle, LogEntry). `MediaStore` stores opaque bytes and returns opaque references — no domain entity is being reconstituted. The appropriate abstraction is a storage port, not a domain repository.

---

## Interface

```ts
// apps/web/src/lib/media/MediaStore.ts

export interface MediaRef {
  id: string;           // stable UUID, assigned at save time
  mediaType: 'IMAGE' | 'VIDEO';
  path: string;         // opaque storage reference:
                        //   V1 OPFS: virtual path under the media origin directory
                        //   V2 cloud: cloud storage key or remote URL
}

export interface StoredMedia {
  ref: MediaRef;
  url: string;          // object URL (V1) or remote URL (V2) — valid for display
  caption?: string;
  sortOrder: number;
}

export interface MediaStore {
  save(logEntryId: string, file: File): Promise<MediaRef>;
  getUrl(ref: MediaRef): Promise<string>;
  delete(ref: MediaRef): Promise<void>;
  listForEntry(logEntryId: string): Promise<StoredMedia[]>;
}
```

The `path` field of `MediaRef` is what gets persisted in `LogMedia.path` in the database. It is protocol-agnostic and opaque to the database — the `MediaStore` implementation is the only thing that knows how to resolve it.

---

## V1 Adapter — OPFS

```
apps/web/src/lib/media/OpfsMediaStore.ts
```

Uses the browser's [Origin Private File System](https://fs.spec.whatwg.org/#origin-private-file-system) API. Files are stored within the browser's sandboxed origin storage under a directory structure:

```
opfs://
  media/
    logentries/
      [logEntryId]/
        [uuid].[ext]
```

The `path` stored in `MediaRef` follows this virtual structure (e.g. `media/logentries/abc123/img-uuid.jpg`). `getUrl` resolves this path to an OPFS file handle and returns an object URL via `URL.createObjectURL`.

### Why OPFS over the File System Access API

| | OPFS | File System Access API |
|---|---|---|
| User permission prompt | None required | Requires user to pick a folder on first use; re-grant may be required |
| Persistence | Persistent within the browser origin | Persistent if the `FileSystemDirectoryHandle` is stored in IndexedDB |
| Quota | Large (device-storage limited, per browser) | Same |
| V2 swap | Clean interface swap | Same |
| Browser support | All modern browsers (Chrome 86+, Firefox 111+, Safari 15.2+) | Chrome 86+, Firefox 111+, Safari 15.2+ |

OPFS requires no permission prompts and no user-facing folder-selection UX. The Owner's media is stored silently and persistently within Revlog's origin.

### File size limits (enforced client-side before save)

- Images: maximum 10 MB per file
- Videos: maximum 100 MB per file
- Per log entry: maximum 10 files combined

Validation happens in the Log Entry screen before calling `save()`; `OpfsMediaStore` does not re-validate size.

---

## Injection

`MediaStore` is provided via React context so all consuming components receive the same implementation and so it can be swapped in tests.

```
apps/web/src/lib/media/MediaStoreProvider.tsx   — context provider
apps/web/src/lib/media/useMediaStore.ts          — consumer hook
```

The provider wraps the app in `apps/web/src/app/layout.tsx` alongside `AuthProvider`, passing an `OpfsMediaStore` instance:

```tsx
<AuthProvider>
  <MediaStoreProvider store={new OpfsMediaStore()}>
    {children}
  </MediaStoreProvider>
</AuthProvider>
```

In Cypress E2E tests, a `MockMediaStore` (in-memory, no OPFS dependency) is injected instead.

---

## Use cases

### UC-MEDIA-1 — Attach photos and videos when creating a log entry

**Actor:** Owner
**Precondition:** Owner is on the Log Entry creation screen; OPFS is available in the browser

1. Owner selects one or more files via the file picker
2. Screen validates each file (type and size); rejects invalid files with per-file errors
3. For each valid file, screen calls `mediaStore.save(logEntryId, file)` → receives a `MediaRef`
4. Screen displays a preview (thumbnail or poster frame) for each saved file
5. Owner saves the Log Entry; the `MediaRef.path` values are included in the `POST /vehicles/:vehicleId/log` payload as `media[].path`

---

### UC-MEDIA-2 — View media attached to a log entry

**Actor:** Owner
**Precondition:** Log Entry with attached media refs exists; Owner is on the edit screen for that entry

1. Screen loads the Log Entry's `media` array (paths + metadata) from the API
2. For each media ref, screen calls `mediaStore.getUrl(ref)` → receives a display URL
3. Screen renders thumbnails/previews using the display URLs

---

### UC-MEDIA-3 — Remove a media attachment

**Actor:** Owner
**Precondition:** Owner is on the Log Entry screen with at least one media preview

1. Owner selects `[×]` on a preview
2. Screen calls `mediaStore.delete(ref)` — removes the file from OPFS
3. Preview disappears; the media ref is excluded from the save payload

---

### UC-MEDIA-4 — Media persists across sessions

**Actor:** Owner
**Precondition:** Owner previously created a Log Entry with media; they return in a new browser session

1. Screen loads the Log Entry with its `media` array from the API (paths only)
2. Screen calls `mediaStore.getUrl(ref)` for each path
3. OPFS resolves each path to the stored file and returns a fresh object URL
4. Previews display correctly without any re-upload

---

## Acceptance Criteria

- [ ] `OpfsMediaStore.save()` stores the file in OPFS and returns a `MediaRef` with a stable `id` and `path`
- [ ] `OpfsMediaStore.getUrl()` returns a valid object URL for a previously saved file
- [ ] `OpfsMediaStore.getUrl()` throws (or returns null) for a `path` that does not exist in OPFS
- [ ] `OpfsMediaStore.delete()` removes the file from OPFS; subsequent `getUrl()` calls fail
- [ ] `OpfsMediaStore.listForEntry()` returns all stored media for a given `logEntryId`
- [ ] Media stored in one browser session is retrievable in a subsequent session (OPFS persistence)
- [ ] Files exceeding size limits are rejected before `save()` is called (enforced in the Log Entry screen)
- [ ] Up to 10 files per log entry are accepted; an 11th triggers an error
- [ ] `useMediaStore()` hook provides the injected implementation
- [ ] In Cypress tests, a `MockMediaStore` can be injected in place of `OpfsMediaStore`

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| OPFS over File System Access API | OPFS (no permission prompt) | Simpler UX — Owner's media is stored automatically without requiring folder selection. See comparison table above. |
| Port/Adapter, not Repository | `MediaStore` interface, not `IMediaRepository` | Repositories are for domain aggregates; `MediaStore` handles opaque bytes. The terminology difference keeps the two concerns distinct and avoids confusion. |
| Injection via React context | `MediaStoreProvider` + `useMediaStore()` | Consistent with `AuthProvider`'s pattern; allows test implementations to be swapped without module mocking |
| `path` is opaque in the DB | `LogMedia.path` stores the implementation-specific ref string | The database stores a pointer, not an interpretation. The `MediaStore` implementation is the only decoder. This allows V1 OPFS paths and V2 cloud keys to coexist in the same column during a migration. |
| Size limits enforced client-side only | Validation before `save()`; `OpfsMediaStore` does not re-validate | OPFS storage is local — there is no server-side enforcement surface. V2's `CloudMediaStore` will enforce limits during upload. |

---

## V2 — Cloud adapter

When V2 introduces cloud storage (e.g. S3, GCS, Cloudflare R2):

1. Implement `CloudMediaStore` satisfying the same `MediaStore` interface
2. Files are compressed before upload (images: lossy resize to reasonable resolution; videos: transcode)
3. `path` becomes a cloud storage key or signed URL
4. Swap the injected implementation in `MediaStoreProvider` — no component changes required
5. A migration step re-uploads existing OPFS files to the cloud and updates `LogMedia.path` in the database

---

## Out of scope

- Video thumbnail/poster-frame generation (V2 — client-side preview uses the `<video>` element's default frame)
- Media compression (V2 — applies at upload time in `CloudMediaStore`)
- Multi-device media sync (V2 — OPFS is per-browser-origin; cloud storage resolves this)
- Media CDN / delivery optimisation (V2)
