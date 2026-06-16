# Web Component Consolidation

**Status:** Planned  
**Area:** `apps/web/src/application/`

---

## Motivation

Screen files under `application/screens/` define presentational sub-components inline. Several of these components are either duplicated across screens (LoadingState, ErrorState, NotFoundState) or are complex enough that they belong in the shared `application/components/` folder regardless of current reuse count (VehicleCard, LogEntryCard). Consolidating them:

- eliminates copy-paste drift between duplicate state components
- makes each screen file focused on layout/wiring rather than primitive definitions
- gives Storybook a clear surface to document (see [Storybook section](#storybook))

---

## Existing shared components (no change)

These already live in `application/components/` and are not moved.

| Component | File | Props |
|-----------|------|-------|
| `FormField` | `FormField.tsx` | `{ label, id, optional?, error?, classes, children }` |
| `Wordmark` | `Wordmark.tsx` | `{ classes }` |
| `StatusOrb` | `StatusOrb.tsx` | `{ state: "verifying" \| "verified" }` |
| `GoogleIcon` | `GoogleIcon.tsx` | `{ size?: number }` |
| All icon exports | `icons.tsx` | `{ size?: number }` (per icon; `CameraIcon` also accepts `className`) |

---

## Components to consolidate

### 1. `StateBlock`

**New file:** `application/components/StateBlock.tsx`

A single component replacing the duplicated `LoadingState`, `ErrorState`, `NotFoundState`, and `EmptyState` / `EmptyHistory` inline definitions. Currently these exist in three screen files with near-identical structure but different copy.

```typescript
export type StateBlockVariant = "loading" | "error" | "not-found" | "empty";

export interface StateBlockAction {
  label: string;
  /** Render as <Link> when provided, <button> otherwise. */
  href?: string;
  onClick?: () => void;
  testId?: string;
  icon?: React.ReactNode;
}

export interface StateBlockProps {
  variant: StateBlockVariant;
  headline: string;
  body: string;
  action?: StateBlockAction;
  /** Optional illustration slot — accepts any ReactNode (icon, glyph, etc.). */
  illustration?: React.ReactNode;
  testId?: string;
}
```

**Current inline instances being replaced:**

| Screen | Inline name | Variant | Notes |
|--------|-------------|---------|-------|
| `GarageScreen` | `LoadingState` | `"loading"` | No action |
| `GarageScreen` | `ErrorState` | `"error"` | Retry button (`onClick`) |
| `GarageScreen` | `EmptyState` | `"empty"` | Add vehicle link (`href`), dashed glyph illustration |
| `VehicleDetailScreen` | `LoadingState` | `"loading"` | No action |
| `VehicleDetailScreen` | `ErrorState` | `"error"` | Retry button (`onClick`) |
| `VehicleDetailScreen` | `NotFoundState` | `"not-found"` | Back to Garage link (`href`) |
| `VehicleDetailScreen` | `EmptyHistory` | `"empty"` | Add log entry link (`href`), clipboard icon illustration |
| `EditVehicleScreen` | `NotFoundState` | `"not-found"` | Back to Garage link (`href`) |
| `EditVehicleScreen` | `ErrorState` | `"error"` | Back to Garage link (`href`) |

**Styling note:** Each screen currently uses its own CSS module class (e.g. `styles.emptyState` vs `styles.stateBlock`). The consolidated component will ship with its own `StateBlock.module.css` using design tokens. Callers may pass an optional `className` if they need a layout override (max-width, margin, etc.).

---

### 2. `ReadField`

**New file:** `application/components/ReadField.tsx`

A read-only label + value display used in `InsuranceDialog` today. Extracting it makes it available for any future detail/view panel.

```typescript
export interface ReadFieldProps {
  label: string;
  /** Displays an em-dash when null or undefined. */
  value: string | null | undefined;
}
```

**Current inline instances being replaced:**

| File | Usage count |
|------|-------------|
| `screens/vehicle-detail/InsuranceDialog.tsx` | 7 callsites |

---

### 3. `VehicleCard`

**New file:** `application/components/VehicleCard.tsx`

The clickable vehicle summary card rendered inside `GarageScreen`. Complex enough (photo strip, overlay, odometer stat, entry count, display logic) to be a standalone component. Currently used only in `GarageScreen` but a natural candidate for search results or any future vehicle list surface.

```typescript
// VehicleSummary imported from @maintenance-log/domain
export interface VehicleCardProps {
  vehicle: VehicleSummary;
}
```

**Current inline instances being replaced:**

| Screen | Inline name |
|--------|-------------|
| `GarageScreen` | `VehicleCard` |

**Styling note:** The card renders with CSS module classes from `GarageScreen.module.css` today. After extraction it ships with `VehicleCard.module.css`.

---

### 4. `LogEntryCard`

**New file:** `application/components/LogEntryCard.tsx`

The clickable log entry card rendered inside `VehicleDetailScreen`. Complex enough (type badge with variant classes, cost display, meta row with icons) to be a standalone component. The `TYPE_META` constant that drives the badge style should move into this file.

```typescript
// LogEntrySummary imported from @maintenance-log/domain
export interface LogEntryCardProps {
  entry: LogEntrySummary;
  vehicleId: string;
}
```

**Current inline instances being replaced:**

| Screen | Inline name |
|--------|-------------|
| `VehicleDetailScreen` | `LogEntryCard` |

The `TYPE_META` constant (type labels, icons, CSS class suffixes) currently lives at the top of `VehicleDetailScreen.tsx`. It also lives, separately, inside `LogEntryFormView.tsx` under the name `TYPE_META` with slightly different shape (adds a `tooltip` field). After extraction:

- `LogEntryCard.tsx` owns the display-oriented `TYPE_META` (label, icon, cls).
- `LogEntryFormView.tsx` retains its own `TYPE_META` (label, tooltip, icon) because that metadata drives form UI, not cards.

---

### 5. `Field` → merge with `FormField`

The `Field` component defined inline in `LoginScreen` is a simpler cousin of the shared `FormField`:

```typescript
// LoginScreen's inline Field — no id, no error slot, no optional marker
{ label: string; children: React.ReactNode; className?: string }

// Shared FormField
{ label, id, optional?, error?, classes, children }
```

The two serve different contexts (login form vs. vehicle forms with validation). Rather than forcing a merger that adds dead props to one or the other, `Field` stays inline in `LoginScreen`. If a second screen needs the same minimal label+children wrapper, extract it then.

---

## Components intentionally left inline

| Component | Screen | Reason |
|-----------|--------|--------|
| `StepIndicator` | `OnboardingScreen` | Only used in one place; tightly coupled to `OnboardingStep` enum and the wizard's visual language |
| `StatsStrip` | `VehicleDetailScreen` | Only used once; closely coupled to `VehicleDetail` shape and this screen's layout |
| `InsuranceRow` | `VehicleDetailScreen` | Domain-specific; tightly coupled to `InsuranceRecord` and the vehicle detail layout |
| `PrimaryButton` | `LoginScreen` | Login-specific; the auth screens have their own visual language separate from the app shell |
| `Scene`, `WaitingCopy`, `VerifyingCopy`, `VerifiedCopy`, `ErrorCopy`, `VerifyEmailBody` | `VerifyEmailScreen` | All tightly coupled to the verify-email state machine; no other screen needs these |

---

## Target component folder layout after consolidation

```
application/components/
  FormField.tsx               (existing — no change)
  GoogleIcon.tsx              (existing — no change)
  icons.tsx                   (existing — no change)
  LogEntryCard.tsx            ← new (moved from VehicleDetailScreen)
  LogEntryCard.module.css     ← new
  ReadField.tsx               ← new (moved from InsuranceDialog)
  StateBlock.tsx              ← new (replaces LoadingState/ErrorState/NotFoundState/EmptyState)
  StateBlock.module.css       ← new
  StatusOrb.module.css        (existing — no change)
  StatusOrb.tsx               (existing — no change)
  VehicleCard.tsx             ← new (moved from GarageScreen)
  VehicleCard.module.css      ← new
  Wordmark.tsx                (existing — no change)
```

---

## Storybook

Extracting these components into `application/components/` creates a clean, props-driven surface that maps directly to Storybook stories. The recommended setup:

- **Package:** `@storybook/nextjs` (handles Next.js / App Router / CSS modules out of the box)
- **Location:** stories co-located with components, e.g. `VehicleCard.stories.tsx` next to `VehicleCard.tsx`
- **Stories to write at minimum:**
  - `StateBlock` — one story per `variant` (loading, error, not-found, empty), plus variants with/without illustration and action
  - `VehicleCard` — with photo, without photo (glyph fallback), no log entries yet
  - `LogEntryCard` — one story per `LogEntryType`, with and without cost/media/items
  - `ReadField` — with value, with null (em-dash fallback)
  - `FormField` — with and without error, with optional marker
  - `StatusOrb` — verifying and verified states

Storybook setup is a separate task from the extraction itself and should be done after the component moves land and E2E tests confirm no regressions.

---

## Acceptance criteria

- [ ] `StateBlock` replaces all 9 inline state-component callsites across 3 screens
- [ ] `ReadField` replaces all 7 callsites inside `InsuranceDialog`
- [ ] `VehicleCard` is moved out of `GarageScreen` into `components/`; `GarageScreen` imports it
- [ ] `LogEntryCard` is moved out of `VehicleDetailScreen` into `components/`; `VehicleDetailScreen` imports it
- [ ] `TYPE_META` for card display lives in `LogEntryCard.tsx`; `LogEntryFormView.tsx` retains its own copy
- [ ] All screens compile with no TypeScript errors after the moves
- [ ] Existing Cypress E2E suite passes without modification (all `data-testid` attributes are preserved on the extracted components)
- [ ] No raw hex/color/spacing values are introduced in the new component files (design token rule)
- [ ] No inline `style={{}}` props in any new component file

---

## Decisions

**Why `StateBlock` and not three separate `LoadingState` / `ErrorState` / `NotFoundState` components?**  
The four inline variants share identical DOM structure (container → headline → body → optional action). A single component with a `variant` prop avoids fragmentation while still allowing callers to pass their own copy. The variant prop is kept for Storybook and `data-testid` defaulting even if the visual difference between variants is purely in the copy.

**Why keep `StatsStrip` and `InsuranceRow` inline?**  
Both are tightly bound to a single screen's data shape and layout. Extracting them would add indirection without enabling reuse. The rule is: extract when there are two or more callsites, or when the component is complex enough to warrant isolated documentation/testing. Neither condition applies here.

**Why not unify `Field` (LoginScreen) with `FormField`?**  
The shared `FormField` is designed for validated vehicle forms: it takes `id` (for `htmlFor`), an `error` string, an `optional` marker, and a `classes` bag so the host screen controls sizing via its own CSS module. `Field` in the login screen skips all of that — it only wraps a label and children and accepts an optional extra `className`. Merging them would add unused props to one of the two use-cases. Defer extraction until a second consumer appears.
