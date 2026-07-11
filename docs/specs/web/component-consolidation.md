# Web Component Consolidation

**Status:** Planned  
**Area:** `apps/web/src/application/`

---

## Motivation

Screen files under `application/screens/` define presentational sub-components inline. The audit across all 10 screen files found two distinct problems:

1. **Duplication of state components** — `LoadingState`, `ErrorState`, `NotFoundState`, `EmptyState` are copy-pasted across three screens with near-identical structure.
2. **Re-implementation of UI primitives** — every screen independently invents its own buttons, inputs, form fields, dialogs, and badges. There are 15+ distinct button CSS class names across the modules (`primaryBtn`, `btnPrimary`, `btnGhost`, `btnDelete`, `btnSave`, `btnDialogSave`, `btnStateAction`, …) that all collapse to a handful of semantic variants.

The goal is a two-tier component model:

- **Tier 1 — UI primitives** in `application/components/ui/`: pure presentational components with no domain knowledge. These are the design system — the shared vocabulary every screen speaks.
- **Tier 2 — Domain-aware components** in `application/components/`: components that understand app data shapes (`VehicleSummary`, `LogEntrySummary`, etc.) and compose primitives to render domain objects.

Screens become layout + wiring files: they import from one or both tiers and connect view models to views.

---

## Component hierarchy

```
application/
  components/
    ui/                        ← Tier 1: design system primitives
      Badge.tsx
      Badge.module.css
      Button.tsx
      Button.module.css
      Dialog.tsx
      Dialog.module.css
      ErrorBanner.tsx
      ErrorBanner.module.css
      Field.tsx                ← replaces FormField
      Field.module.css
      Input.tsx
      Input.module.css
      PhotoUploadZone.tsx
      PhotoUploadZone.module.css
      PillGroup.tsx
      PillGroup.module.css
      Select.tsx
      Select.module.css
      StepIndicator.tsx
      StepIndicator.module.css
      Tabs.tsx
      Tabs.module.css
      Textarea.tsx
      Textarea.module.css
    LogEntryCard.tsx           ← Tier 2: domain-aware
    LogEntryCard.module.css
    ReadField.tsx
    StateBlock.tsx
    StateBlock.module.css
    VehicleCard.tsx
    VehicleCard.module.css
    # existing, unchanged
    GoogleIcon.tsx
    icons.tsx
    StatusOrb.tsx
    StatusOrb.module.css
    Wordmark.tsx
```

`FormField.tsx` is removed after `Field` lands and all callsites are updated.

---

## Tier 1 — UI primitives

### `Button`

Replaces every ad-hoc button pattern across all screens. The audit found 15+ distinct button CSS class names that reduce to five semantic variants and two sizes.

```typescript
export type ButtonVariant =
  | "primary"   // accent background — main CTA
  | "ghost"     // transparent + border — secondary action
  | "outline"   // transparent + muted border — tertiary action
  | "text"      // no border, no background — minimal inline action
  | "danger";   // danger-colored border/background — destructive action

export type ButtonSize = "md" | "sm";

export interface ButtonProps {
  variant?: ButtonVariant;        // default: "primary"
  size?: ButtonSize;              // default: "md"
  type?: "button" | "submit";    // default: "button"
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** Stretch to fill container width */
  fullWidth?: boolean;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}
```

**Inline patterns replaced:**

| Current class(es) | Screen(s) | Maps to |
|---|---|---|
| `primaryBtn`, `btnPrimary` | All screens | `variant="primary"` |
| `btnGhost` | OnboardingScreen, AddVehicleScreen | `variant="ghost"` |
| `btnOutline` | VehicleDetailScreen topbar | `variant="outline"` |
| `textLink` | OnboardingScreen ("Skip for now") | `variant="text"` |
| `btnDelete` | LogEntryFormView | `variant="danger"` |
| `btnConfirmDelete` | EditLogEntryScreen | `variant="danger"` |
| `btnDialogCancel` | InsuranceDialog | `variant="ghost" size="sm"` |
| `btnDialogSave` | InsuranceDialog | `variant="primary" size="sm"` |
| `btnDialogEdit` | InsuranceDialog | `variant="outline" size="sm"` |
| `btnStateAction` | VehicleDetailScreen | `variant="primary" size="sm"` |
| `btnSave` | LogEntryFormView | `variant="primary" size="sm"` |
| `btnInsuranceAction` | VehicleDetailScreen | `variant="text"` |
| `btnAddItem` | LogEntryFormView | `variant="ghost" size="sm"` (dashed border variant) |
| `PrimaryButton` (named component) | LoginScreen | `variant="primary"` |

The "add item" dashed-border style is the only pattern that doesn't map cleanly to the five variants. It becomes `variant="ghost"` with a `dashed` boolean prop, or stays inline in `LogEntryFormView` if the dashed style is truly one-off.

The `googleBtn` (Google OAuth) stays inline in `LoginScreen` because it has a unique brand-specific appearance not appropriate for the design system.

Circular icon-only remove buttons (`photoRemoveBtn`, `mediaRemoveBtn`, `btnRemoveRow`) use the `aria-label` prop and an icon as `children` — no special icon-button variant needed.

---

### `Input`

Replaces the scattered `input`, `fieldInput`, `inputWithSuffix` patterns.

```typescript
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> {
  /** Trailing label inside the input — e.g. "mi", "/ month" */
  suffix?: string;
  error?: boolean;
  className?: string;
}
```

**Used in:** LoginScreen, OnboardingScreen, AddVehicleScreen, EditVehicleScreen, InsuranceDialog, LogEntryFormView (title, odometer, item descriptions, costs, date, time fields).

The `suffix` prop renders the inline unit label (currently a sibling `<span>` with `position: absolute`). The underlying `<input>` receives appropriate `padding-right` via the component's own CSS module when `suffix` is set.

---

### `Textarea`

```typescript
export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  error?: boolean;
  /** When provided, renders a character counter below the textarea */
  maxLength?: number;
  className?: string;
}
```

The character counter (`N / maxLength`, warning state at ≥80%) is internal to `Textarea` — callers do not wire it separately. Currently `LogEntryFormView` manages the counter display manually alongside the textarea.

**Used in:** InsuranceDialog (notes), LogEntryFormView (notes).

---

### `Select`

```typescript
export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  options: SelectOption[];
  error?: boolean;
  className?: string;
}
```

**Used in:** VehicleDetailScreen (type filter), LogEntryFormView (item category, premium period), InsuranceDialog (premium period).

---

### `Field`

Replaces the existing shared `FormField` and the inline `Field` component in `LoginScreen`. The key change from `FormField` is dropping the `classes` bag: the `Field` primitive owns its own styling and callers use `className` for layout-level overrides (e.g. spanning columns in a grid).

```typescript
export interface FieldProps {
  label: string;
  /** Wires the label's `htmlFor` */
  htmlFor?: string;
  optional?: boolean;
  error?: string;
  /** Helper text displayed below the input */
  hint?: string;
  children: React.ReactNode;
  className?: string;
}
```

**Migration:** All callsites of `FormField` switch to `Field` and drop the `classes` prop. The `id` prop is renamed `htmlFor` to match standard HTML semantics. `FormField.tsx` is deleted.

**Used in:** OnboardingScreen, AddVehicleScreen, EditVehicleScreen, InsuranceDialog (edit mode), LogEntryFormView (partially — the log entry form uses labels more freely), LoginScreen (replaces the inline `Field`).

---

### `Badge`

The log entry type badge currently lives inline in `VehicleDetailScreen` as a `<span>` with a `TYPE_META`-driven class. Extracting it makes the type-coloring logic available to `LogEntryCard` and any future list or filter that needs to display entry types.

```typescript
export type LogEntryType =
  | "MAINTENANCE" | "REPAIR" | "INSPECTION"
  | "MODIFICATION" | "INCIDENT" | "EVENT" | "OTHER";

export interface BadgeProps {
  typeId: LogEntryType;
  /** Optional size override — default "md" */
  size?: "sm" | "md";
}
```

The `TYPE_META` table (label, emoji icon, CSS class suffix) moves into `Badge.tsx`. `LogEntryCard` imports `Badge` and no longer needs its own copy. `LogEntryFormView` retains a separate `TYPE_META` because that one drives the type-selector pills and carries an additional `tooltip` field.

**Used in:** `LogEntryCard` (after extraction), `VehicleDetailScreen` (type filter label rendering).

---

### `Tabs`

The auth mode selector in `LoginScreen` (Login / Create account) is a generic tab pattern that any future two-mode UI can use.

```typescript
export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  "aria-label"?: string;
}
```

**Used in:** LoginScreen (login/register mode toggle).

---

### `PillGroup`

The log entry type selector in `LogEntryFormView` is a horizontal pill selector. Extracting it makes the pattern available for any multi-option toggle that outgrows a dropdown.

```typescript
export interface PillOption {
  id: string;
  label: string;
  icon?: string;          // emoji or short text prefix
  tooltip?: string;
}

export interface PillGroupProps {
  options: PillOption[];
  value: string;
  onChange: (id: string) => void;
  "data-testid"?: string;
}
```

**Used in:** LogEntryFormView (type selection).

---

### `Dialog`

The backdrop + container pattern currently exists in two places with near-identical structure: `InsuranceDialog` and the delete confirmation modal in `EditLogEntryScreen`. The `Dialog` primitive provides the shell; each caller provides its own content.

```typescript
export interface DialogProps {
  title: string;
  onClose: () => void;
  /** Main content — form fields, read fields, etc. */
  children: React.ReactNode;
  /** Footer slot — action buttons */
  footer: React.ReactNode;
  /** Inline error shown above the footer */
  error?: string | null;
  "data-testid"?: string;
}
```

**Used in:** `InsuranceDialog` (wraps the insurance form/view), `EditLogEntryScreen` (delete confirmation).

The `InsuranceDialog` component is renamed `InsuranceDialogContent` and becomes purely responsible for the insurance-specific fields and logic. It renders inside a `<Dialog>`.

---

### `StepIndicator`

Currently defined inline in `OnboardingScreen` as the `StepIndicator` function component. Extracted so Storybook can document the stepper and any future wizard can use it.

```typescript
export interface StepIndicatorStep {
  label: string;
}

export interface StepIndicatorProps {
  steps: StepIndicatorStep[];
  /** 0-indexed current step */
  currentStep: number;
}
```

**Used in:** OnboardingScreen.

---

### `ErrorBanner`

The error banner (danger-colored box shown below a form) appears in `LogEntryFormView` and `EditLogEntryScreen`. Currently each has its own `errorBanner` CSS class.

```typescript
export interface ErrorBannerProps {
  message: string;
  "data-testid"?: string;
}
```

**Used in:** LogEntryFormView, EditLogEntryScreen.

---

### `PhotoUploadZone`

The photo upload area (dashed border → preview image → remove button) is duplicated across `OnboardingScreen` and `AddVehicleScreen` with nearly identical markup. `LogEntryFormView` has a related but distinct multi-file media grid (`mediaGrid`, `mediaThumb`) — that stays inline for now because it supports video, captions, and multiple files.

```typescript
export interface PhotoUploadZoneProps {
  /** Controlled — undefined means no photo selected */
  photoUrl: string | undefined;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  /** Passed to the hidden file input */
  accept?: string;
  "data-testid"?: string;
}
```

**Used in:** OnboardingScreen (vehicle photo), AddVehicleScreen (vehicle photo).

---

## Tier 2 — Domain-aware components

These know about app data shapes and compose primitives. They live directly in `application/components/` (not in `ui/`).

### `StateBlock`

Replaces nine duplicated inline state components across three screens.

```typescript
export type StateBlockVariant = "loading" | "error" | "not-found" | "empty";

export interface StateBlockAction {
  label: string;
  href?: string;         // renders <Link>
  onClick?: () => void;  // renders <button>
  icon?: React.ReactNode;
  testId?: string;
}

export interface StateBlockProps {
  variant: StateBlockVariant;
  headline: string;
  body: string;
  action?: StateBlockAction;
  /** Illustration slot — icon, glyph, etc. */
  illustration?: React.ReactNode;
  testId?: string;
}
```

| Screen | Replaced inline | Variant |
|--------|----------------|---------|
| `GarageScreen` | `LoadingState` | `"loading"` |
| `GarageScreen` | `ErrorState` | `"error"` |
| `GarageScreen` | `EmptyState` | `"empty"` |
| `VehicleDetailScreen` | `LoadingState` | `"loading"` |
| `VehicleDetailScreen` | `ErrorState` | `"error"` |
| `VehicleDetailScreen` | `NotFoundState` | `"not-found"` |
| `VehicleDetailScreen` | `EmptyHistory` | `"empty"` |
| `EditVehicleScreen` | `NotFoundState` | `"not-found"` |
| `EditVehicleScreen` | `ErrorState` | `"error"` |

---

### `VehicleCard`

Clickable vehicle summary card. Currently inline in `GarageScreen`.

```typescript
export interface VehicleCardProps {
  vehicle: VehicleSummary;  // from @maintenance-log/contracts
}
```

---

### `LogEntryCard`

Clickable log entry card. Currently inline in `VehicleDetailScreen`. Composes `Badge`.

```typescript
export interface LogEntryCardProps {
  entry: LogEntrySummary;   // from @maintenance-log/contracts
  vehicleId: string;
}
```

---

### `ReadField`

Read-only label + value. Currently inline in `InsuranceDialog` (7 callsites).

```typescript
export interface ReadFieldProps {
  label: string;
  value: string | null | undefined;  // displays "—" when falsy
}
```

---

## Components intentionally left inline or unchanged

| Component | Location | Reason |
|-----------|----------|--------|
| `StatsStrip` | `VehicleDetailScreen` | Tightly coupled to `VehicleDetail` shape and this screen's two-column layout |
| `InsuranceRow` | `VehicleDetailScreen` | Domain-specific warning logic; used in one place |
| `googleBtn` | `LoginScreen` | Brand-specific OAuth button; not a design system concern |
| `Scene`, `WaitingCopy`, `VerifyingCopy`, `VerifiedCopy`, `ErrorCopy` | `VerifyEmailScreen` | Tightly coupled to the verify-email state machine |
| `Wordmark` | `application/components/` | Already shared; no change needed |
| `StatusOrb` | `application/components/` | Already shared; no change needed |
| All icon exports | `application/components/icons.tsx` | Already shared; no change needed |
| Media grid (`mediaGrid`, `mediaThumb`) | `LogEntryFormView` | Multi-file, video-capable, caption-per-file — more complex than `PhotoUploadZone`; stays inline until a second consumer appears |

---

## Storybook

With primitives isolated in `application/components/ui/`, Storybook has a clean, domain-free surface to document.

**Recommended setup:**
- Package: `@storybook/nextjs` — handles Next.js App Router, CSS modules, and the `@maintenance-log/ui` token package out of the box
- Stories co-located next to components: `Button.stories.tsx` beside `Button.tsx`
- A `globals.css` import in `.storybook/preview.ts` to load design tokens

**Minimum stories per component:**

| Component | Stories |
|-----------|---------|
| `Button` | One story per `variant` × `size`; disabled state; with leading/trailing icons |
| `Input` | Default; with suffix; error state; disabled |
| `Textarea` | Default; with char counter at 0%, 75%, 100% |
| `Select` | Default; error state |
| `Field` | With label only; with optional; with error; with hint |
| `Badge` | One story per `LogEntryType` |
| `Tabs` | Two tabs, active on each |
| `PillGroup` | All seven log entry types, each active |
| `Dialog` | With content; with error |
| `StepIndicator` | Three steps: step 1 active; step 2 active; step 3 done |
| `ErrorBanner` | Short message; long message |
| `PhotoUploadZone` | Empty; with photo preview |
| `StateBlock` | One story per `variant`; with and without illustration |
| `VehicleCard` | With photo; without photo; no log entries |
| `LogEntryCard` | One per `LogEntryType`; with cost; with media; minimal |
| `ReadField` | With value; null (em-dash) |

Storybook is a follow-on task — implement after all component moves land and E2E tests confirm no regressions.

---

## Migration order

The components have dependencies: primitives must land before domain-aware components that compose them, and domain-aware components must land before the screens are updated.

1. **`Button`** — unblocks everything; most screens need it
2. **`Input`, `Textarea`, `Select`** — unblock `Field` and the form screens
3. **`Field`** (replaces `FormField`) — depends on the input primitives being available
4. **`Badge`** — needed by `LogEntryCard`
5. **`Tabs`, `PillGroup`, `StepIndicator`, `ErrorBanner`, `PhotoUploadZone`, `Dialog`** — can be done in parallel after `Button` lands
6. **`StateBlock`, `VehicleCard`, `ReadField`** — pure extractions, no primitive dependencies
7. **`LogEntryCard`** — depends on `Badge`
8. **Update screens** to import from `components/ui/` and `components/` — done per screen after the relevant primitives exist
9. **Delete `FormField.tsx`** — after all callsites are migrated to `Field`
10. **Storybook** — after all components are in place and E2E green

---

## Acceptance criteria

### Tier 1 primitives
- [ ] `Button` covers all five variants and both sizes; all previous button class patterns are replaced
- [ ] `Input` handles plain, suffix, and error states; the `inputWithSuffix` pattern is gone from all screens
- [ ] `Textarea` renders its own char counter when `maxLength` is provided; `LogEntryFormView` no longer manages counter state manually
- [ ] `Select` replaces all `filterSelect` / `select` / dropdown patterns
- [ ] `Field` replaces `FormField` at all callsites; `FormField.tsx` is deleted; `htmlFor` wires `<label>` correctly
- [ ] `Badge` owns the type-coloring `TYPE_META`; `VehicleDetailScreen` no longer defines it
- [ ] `Tabs` replaces the auth mode tablist in `LoginScreen`
- [ ] `PillGroup` replaces the type-pill selector in `LogEntryFormView`
- [ ] `Dialog` wraps both `InsuranceDialog` content and the delete confirmation in `EditLogEntryScreen`
- [ ] `StepIndicator` is extracted from `OnboardingScreen`; behavior is identical
- [ ] `ErrorBanner` replaces the inline error banner in `LogEntryFormView` and `EditLogEntryScreen`
- [ ] `PhotoUploadZone` is shared between `OnboardingScreen` and `AddVehicleScreen`

### Tier 2 domain components
- [ ] `StateBlock` replaces all 9 inline state-component callsites across 3 screens
- [ ] `VehicleCard` is extracted from `GarageScreen`
- [ ] `LogEntryCard` is extracted from `VehicleDetailScreen`; composes `Badge`
- [ ] `ReadField` replaces all 7 callsites in `InsuranceDialog`

### Quality gates
- [ ] All screens compile with no TypeScript errors
- [ ] Cypress E2E suite passes without modification — all `data-testid` attributes are preserved on extracted components
- [ ] No raw hex/color/spacing values in any new component file (token rule)
- [ ] No inline `style={{}}` props in any new component file (guardrail rule)
- [ ] `FormField.tsx` is deleted

---

## Decisions

**Why a `ui/` subdirectory inside `components/`?**  
The split between primitive (no domain knowledge) and domain-aware components is a meaningful architectural boundary. Keeping them in the same flat directory obscures that boundary. `ui/` makes it immediately clear that those components are the design system — they have no app-specific data dependencies and are safe to document in isolation via Storybook.

**Why not move primitives to `packages/ui/`?**  
The existing `packages/ui/tokens/` is a non-React package (design tokens only). Extending it to export React components would require setting up a TSX build pipeline and making the web app import from the package. That is worthwhile when a second React app needs these components (e.g. an admin panel). For now, `application/components/ui/` gives the same structural benefit without the tooling overhead. Moving them later is a one-line change per import.

**Why does `Field` drop the `classes` bag from `FormField`?**  
The `classes: Record<string, string>` prop was a workaround: each screen passed its own CSS module so the field could size itself differently per context. That couples the primitive to its callers' CSS modules, breaking encapsulation. The new `Field` owns its own sizing via `Field.module.css` (using design tokens), and callers use the standard `className` prop for layout-level overrides (e.g., spanning grid columns). The token-based sizing is consistent across screens — the per-screen variation was incidental, not intentional.

**Why is `googleBtn` not a design system component?**  
Google's brand guidelines require specific logo treatment, color, and layout that are dictated externally. A design system component implies Revlog owns the visual contract. The Google button is a compliance concern, not a design system concern. It stays inline in `LoginScreen`.

**Why does `LogEntryFormView` keep its own `TYPE_META`?**  
Two `TYPE_META` constants exist today: one drives the read-view badge (label + icon + CSS class), the other drives the form's type-selection pills (label + icon + tooltip). They share the same keys but have different shapes. The `Badge` component absorbs the first; the pill selector's metadata stays in `LogEntryFormView` because it carries a `tooltip` field used only in that context. Merging them would force `Badge` to carry a tooltip it never uses.

**Why does the media grid stay inline in `LogEntryFormView`?**  
The `PhotoUploadZone` handles the single-photo use case (vehicle photo). The media grid in the log entry form handles multiple files, supports video, renders per-file caption inputs, and has a file-picker attachment button as a separate element. The two patterns share a dashed-border upload aesthetic but differ enough in behavior that extraction would either over-generalize `PhotoUploadZone` or produce a wrapper so thin it adds no value. Extract when a second multi-file consumer appears.
