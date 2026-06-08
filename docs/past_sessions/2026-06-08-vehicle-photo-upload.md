# Session: Vehicle photo upload — full-stack implementation

**Date:** 2026-06-08
**Branch/worktree:** `worktree-synthetic-herding-metcalfe`

---

## Goal

Implement vehicle photo upload end-to-end: store an optional photo with each vehicle, display photos in the garage card grid, and expose the upload option in both the new standalone Add Vehicle screen (`/garage/add`) and in the onboarding step 2 wizard. The design had already been prototyped in `docs/designs/revlog-add-vehicle-preview.html`.

---

## Key decisions

- **Single `POST /vehicles` endpoint handles both JSON and multipart** — multer's disk-storage middleware is a no-op when the request has no multipart boundary (i.e., when the client sends `application/json`). Existing callers remain unaffected; no separate "create" vs. "create with photo" route.
- **Separate `POST /vehicles/:id/photo` for standalone photo updates** — a dedicated endpoint lets the garage detail page (V2) offer a "change photo" action without re-submitting vehicle metadata.
- **`photoPath` (filename only) stored in the DB; URL constructed at request time** — avoids hardcoding the API hostname in stored data. `buildPhotoUrl(req, photoPath)` composes `req.protocol + req.get('host') + /uploads/vehicles/ + filename`, so the URL is always correct regardless of environment.
- **`express.static` with `Cross-Origin-Resource-Policy: cross-origin` override** — Helmet sets CORP to `same-origin` globally, which blocks Next.js (a different port) from loading images. A per-path middleware overrides it only for `/uploads` requests.
- **`updateMany` + `findUnique` for `setPhoto`** — `updateMany` with `WHERE id = ? AND accountId = ?` is a single atomic SQL write that enforces account-scoping without a read-then-write race. `findUnique` then returns the updated row as the domain type.
- **`apiUpload` helper in lib/api.ts** — sends `FormData` without setting `Content-Type: application/json` so the browser sets the correct `multipart/form-data; boundary=…` header automatically. Onboarding and the add-vehicle page both use this when a photo is selected, and fall back to `apiFetch` + JSON otherwise.
- **Data: URLs from FileReader cannot use `next/image`** — photo upload previews are shown via `<img>` with an `eslint-disable-next-line` comment. Remote vehicle photos (already served, known URL) use `<Image fill>` with `remotePatterns` configured in `next.config.ts`.

---

## What was built (3 commits)

`a6ae2ec` — **feat(db): add photoPath column to Vehicle**
- `apps/api/prisma/schema.prisma`: added `photoPath String?` to Vehicle model
- `apps/api/prisma/migrations/20260608210504_add_vehicle_photo_path/migration.sql`: `ALTER TABLE "Vehicle" ADD COLUMN "photoPath" TEXT`
- `packages/domain/src/vehicle/index.ts`: added `photoPath: string | null` to `DomainVehicle` and `CreateVehicleData`; added `setPhoto` method to `IVehicleRepository`

`55e3f14` — **feat(api): add vehicle photo upload — POST /vehicles/:id/photo**
- `apps/api/src/lib/upload.ts` (new): multer disk-storage middleware, UUID filenames, image-only filter, 5 MB limit; creates `apps/api/uploads/vehicles/` on import
- `apps/api/src/app.ts`: static serving at `/uploads` with `Cross-Origin-Resource-Policy: cross-origin` header override
- `apps/api/src/repositories/vehicle.repository.ts`: implemented `setPhoto`
- `apps/api/src/services/vehicle.service.ts`: `createVehicle` accepts optional `photoPath`; new `setVehiclePhoto` throws `AppError(404)` when vehicle not found
- `apps/api/src/routes/vehicles.ts`: `POST /` chains multer; new `POST /:id/photo`; `buildPhotoUrl` constructs full URL at request time; responses include `photoUrl`
- `apps/api/src/routes/vehicles.test.ts` and `apps/api/src/services/vehicle.service.test.ts`: full unit test coverage for all new paths (111/111 tests passing)

`4a16622` — **feat(web): vehicle photo upload — garage card strip, add-vehicle page, onboarding photo field**
- `apps/web/src/lib/api.ts`: added `apiUpload<T>` helper
- `apps/web/next.config.ts`: added `remotePatterns` for localhost:3001 and https uploads
- `apps/web/src/app/garage/page.tsx`: `VehicleSummary` includes `photoUrl`; `VehicleCard` renders a photo strip (next/image fill, bleeds to card edges, gradient overlay) when `photoUrl` is set
- `apps/web/src/app/garage/add/page.tsx` (new): standalone Add Vehicle page — two-column layout (form + sticky live preview), photo upload zone with thumbnail preview/remove button, FormData submission when photo selected, JSON fallback otherwise; validates all fields client-side
- `apps/web/src/app/garage/add/add-vehicle.module.css` (new): all styles using design tokens only
- `apps/web/src/app/onboarding/page.tsx`: step 2 now includes an optional photo upload zone; submission uses `apiUpload` + `FormData` when a file is chosen
- `apps/web/src/app/onboarding/onboarding.module.css`: photo zone and remove-button styles
- E2E: `garage.cy.ts` updated with `photoUrl: null` in fixtures and photo-strip test; `onboarding.cy.ts` gains photo-zone visibility and remove-button tests; `add-vehicle.cy.ts` (new) — 14 specs covering page structure, live preview, field validation, happy path (no photo + with photo), and error handling

---

## Verification performed

- `pnpm --filter @maintenance-log/api test --run` → **111/111 passing**
- `npx tsc --noEmit` (apps/web) → **clean**
- `pnpm --filter @maintenance-log/web lint` → **0 errors, 0 warnings** (ESLint max-warnings 0 enforced by pre-commit hook)
- Pre-commit hook (raw token value check) → **passed**

---

## Explicitly out of scope (tracked for later)

- Remove / replace a vehicle's existing photo (detail page — V2)
- `next/image` for data: URL previews — technically impossible; `<img>` with eslint-disable is the correct approach here
- Cloud/remote storage for uploaded photos (S3, etc.) — V2; local disk is the V1 floor
- Image resizing/compression on upload — V2
