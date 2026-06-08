# MediaStore: Port/Adapter pattern for client-side media storage

## Context

The Log Entry feature requires attaching photos and videos to entries. Three storage approaches were considered:

**Option A — Upload to the Express API server (same as vehicle photos)**
Vehicle photos already use this pattern (`POST /vehicles/:id/photo`, stored at `apps/api/uploads/`). Extending it to Log Entry media would reuse existing infrastructure.

Drawbacks: upload latency on every file attach; server disk usage grows unbounded as Owners add more entries; file serving requires the API to be running; and the entire file-serving concern sits in the API layer, which is currently stateless aside from these uploads.

**Option B — IndexedDB blobs**
Store file blobs directly in IndexedDB, which is well-supported and familiar.

Drawbacks: IndexedDB is not designed for large binary blobs; quota behaviour under storage pressure is less predictable than OPFS; reading large blobs back out and constructing object URLs is more cumbersome than OPFS file handles.

**Option C — Origin Private File System (OPFS) behind a Port/Adapter**
OPFS is the browser's dedicated local file storage API — it stores actual files, not serialised blobs, in a sandboxed per-origin filesystem. A Port/Adapter abstraction wraps it so V2 can swap in a cloud implementation with no component changes.

## Decision

Use OPFS in V1 behind a `MediaStore` interface (Port), injected via React context. The `OpfsMediaStore` is the V1 Adapter. A `CloudMediaStore` Adapter is the V2 target.

```
apps/web/src/lib/media/
  MediaStore.ts           ← interface (Port)
  OpfsMediaStore.ts       ← V1 implementation (OPFS)
  MediaStoreProvider.tsx  ← React context, injects OpfsMediaStore
  useMediaStore.ts        ← consumer hook
```

Media file paths (`MediaRef.path`) are persisted in the `LogMedia.path` database column as opaque strings. The `MediaStore` implementation is the only resolver — the database has no opinion about the path format.

The `MediaStore` is a **Port**, not a Repository. Repositories in this codebase map to domain aggregates (Vehicle, LogEntry). `MediaStore` stores and retrieves opaque bytes; no domain entity is reconstituted by it. Using the Repository naming and pattern would conflate two distinct responsibilities.

## Why OPFS over the File System Access API?

The File System Access API lets users pick a directory and grants persistent read/write access to it. This would allow Owners to store media in a folder of their choice (e.g. their Pictures folder).

The drawback for Revlog: picking a folder is an explicit user gesture, and access may need to be re-granted across sessions (browsers handle this differently). This creates friction for a feature that should be invisible — attaching a photo to a log entry should feel like attaching a photo to a message, not configuring a backup location.

OPFS requires no user permission prompts. Files persist within the browser's origin sandbox across sessions without any user action. The trade-off is that files are not directly accessible from the OS file manager, but Revlog Owners are not expected to manage their log media outside the app.

## Trade-offs

- **No server round-trip in V1.** Attaching a file is instant — no upload, no network dependency. This makes the Log Entry creation form feel snappy.
- **Files tied to the browser and device.** An Owner using Revlog on a different device or browser will not see their attached media until V2 introduces cloud storage. This is a known V1 limitation, documented in the Media Store spec.
- **Clean V2 migration path.** `MediaStore` is the only surface that changes. When `CloudMediaStore` lands, a one-time migration script re-uploads existing OPFS files to the cloud and updates `LogMedia.path` in the database. No component changes.
- **Test isolation.** A `MockMediaStore` (in-memory) can be injected in Cypress tests — no OPFS dependency in the test environment.
- **No module mocking required.** Because the implementation is injected via context, unit tests pass a fake directly rather than mocking the module import.
