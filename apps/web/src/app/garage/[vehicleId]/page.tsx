"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/application/providers/AuthProvider";
import { ApiError } from "@/model/errors";
import { getVehicle } from "@/model/services/vehicleService";
import { saveInsurance } from "@/model/services/insuranceService";
import type {
  InsuranceInput,
  InsuranceRecord,
  LogEntrySummary,
  VehicleDetail,
} from "@/model/types";
import { logger } from "@/infrastructure/logging/logger";
import styles from "./vehicle-detail.module.css";

/* ── Constants ──────────────────────────────────────────────────── */

const TYPE_META: Record<string, { label: string; icon: string; cls: string }> = {
  MAINTENANCE: { label: "Maintenance", icon: "🔧", cls: styles.typeMaintenance },
  REPAIR:      { label: "Repair",      icon: "🛠",  cls: styles.typeRepair },
  INSPECTION:  { label: "Inspection",  icon: "🔍", cls: styles.typeInspection },
  MODIFICATION:{ label: "Modification",icon: "⚡", cls: styles.typeModification },
  INCIDENT:    { label: "Incident",    icon: "⚠️", cls: styles.typeIncident },
  EVENT:       { label: "Event",       icon: "🏁", cls: styles.typeEvent },
  OTHER:       { label: "Other",       icon: "📋", cls: styles.typeOther },
};

const TYPE_FILTER_OPTIONS = [
  { value: "ALL", label: "All types" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "REPAIR", label: "Repair" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "MODIFICATION", label: "Modification" },
  { value: "INCIDENT", label: "Incident" },
  { value: "EVENT", label: "Event" },
  { value: "OTHER", label: "Other" },
];

const PREMIUM_PERIOD_LABELS: Record<string, string> = {
  MONTHLY: "/ month",
  QUARTERLY: "/ quarter",
  BIANNUAL: "/ 6 months",
  ANNUAL: "/ year",
};

type LoadState = "loading" | "loaded" | "error" | "not-found";

/* ── Main page ──────────────────────────────────────────────────── */

export default function VehicleDetailPage() {
  const router = useRouter();
  const params = useParams<{ vehicleId: string }>();
  const vehicleId = params.vehicleId;
  const { session, isRestoring } = useAuth();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const [insuranceEditMode, setInsuranceEditMode] = useState(false);

  function retry() {
    setLoadState("loading");
    setRetryToken((n) => n + 1);
  }

  useEffect(() => {
    if (isRestoring) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    getVehicle(session.accessToken, vehicleId)
      .then((vehicle) => {
        if (cancelled) return;
        setVehicle(vehicle);
        setLoadState("loaded");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setLoadState("not-found");
        } else {
          logger.error("failed to load vehicle detail", { err });
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, isRestoring, vehicleId, retryToken, router]);

  function openInsurance(editMode: boolean) {
    setInsuranceEditMode(editMode);
    setInsuranceOpen(true);
  }

  async function handleInsuranceSave(input: InsuranceInput): Promise<void> {
    const insurance = await saveInsurance(session!.accessToken, vehicleId, input);
    setVehicle((prev) => (prev ? { ...prev, insurance } : null));
  }

  const displayName = vehicle
    ? vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`
    : "Vehicle";

  const filteredEntries =
    vehicle && typeFilter !== "ALL"
      ? vehicle.logEntries.filter((e) => e.typeId === typeFilter)
      : vehicle?.logEntries ?? [];

  return (
    <>
      {vehicle && <title>{`Revlog — ${displayName}`}</title>}

      <div className={styles.scene} data-testid="vehicle-detail-page">
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <Link href="/garage" className={styles.backLink} data-testid="back-link">
              <BackIcon />
              Garage
            </Link>
            <div className={styles.wordmark}>
              <span className={styles.wordmarkLight}>Rev</span>
              <span className={styles.wordmarkBold}>log</span>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <Link
              href={`/garage/${vehicleId}/edit`}
              className={styles.btnOutline}
              data-testid="edit-btn"
            >
              <EditIcon />
              Edit
            </Link>
            <Link
              href={`/garage/${vehicleId}/log/new`}
              className={styles.btnPrimary}
              data-testid="new-log-entry-btn"
            >
              <PlusIcon />
              Log entry
            </Link>
          </div>
        </header>

        {loadState === "loading" && <LoadingState />}
        {loadState === "error" && <ErrorState onRetry={retry} />}
        {loadState === "not-found" && <NotFoundState />}

        {loadState === "loaded" && vehicle && (
          <>
            <div className={styles.hero} data-testid="hero-panel">
              {vehicle.photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element -- user-uploaded photo served by local Express */
                <img
                  src={vehicle.photoUrl}
                  alt={displayName}
                  className={styles.heroPhoto}
                  data-testid="hero-photo"
                />
              ) : (
                <div className={styles.heroGlyph} data-testid="hero-glyph">
                  <VehicleGlyphIcon />
                </div>
              )}
              <div className={styles.heroOverlay} />
              <div className={styles.heroMeta}>
                <h1 className={styles.heroName} data-testid="vehicle-display-name">
                  {displayName}
                </h1>
                <p className={styles.heroSub} data-testid="vehicle-meta">
                  {vehicle.make} · {vehicle.model} · {vehicle.year}
                </p>
              </div>
            </div>

            <div className={styles.contentWrap}>
              <StatsStrip vehicle={vehicle} />

              <InsuranceRow
                insurance={vehicle.insurance}
                onOpen={openInsurance}
              />

              <section aria-label="Service history">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Service history</h2>
                  <select
                    className={styles.filterSelect}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label="Filter by type"
                    data-testid="type-filter"
                  >
                    {TYPE_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredEntries.length === 0 ? (
                  <EmptyHistory vehicleId={vehicleId} />
                ) : (
                  <div className={styles.entryList} data-testid="log-entry-list">
                    {filteredEntries.map((entry) => (
                      <LogEntryCard
                        key={entry.id}
                        entry={entry}
                        vehicleId={vehicleId}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>

      {insuranceOpen && vehicle && (
        <InsuranceDialog
          insurance={vehicle.insurance}
          initialEditMode={insuranceEditMode}
          onSave={handleInsuranceSave}
          onClose={() => setInsuranceOpen(false)}
        />
      )}
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function StatsStrip({ vehicle }: { vehicle: VehicleDetail }) {
  const entryCount = vehicle.logEntries.length;
  const totalSpent = parseFloat(vehicle.stats.totalSpent);

  return (
    <div className={styles.statsStrip} data-testid="stats-strip">
      <div className={styles.statBlock}>
        <div className={styles.statValue} data-testid="stat-odometer">
          {vehicle.mileage.toLocaleString()}
          <span className={styles.unit}>mi</span>
        </div>
        <div className={styles.statLabel}>Odometer</div>
      </div>
      <div className={styles.statBlock}>
        <div
          className={entryCount > 0 ? styles.statValue : `${styles.statValue} ${styles.statValueEmpty}`}
          data-testid="stat-entry-count"
        >
          {entryCount > 0 ? entryCount : "None"}
        </div>
        <div className={styles.statLabel}>Log entries</div>
      </div>
      <div className={styles.statBlock}>
        <div
          className={vehicle.stats.lastLoggedAt ? styles.statValue : `${styles.statValue} ${styles.statValueEmpty}`}
          data-testid="stat-last-logged"
        >
          {vehicle.stats.lastLoggedAt ? formatShortDate(vehicle.stats.lastLoggedAt) : "Never"}
        </div>
        <div className={styles.statLabel}>Last logged</div>
      </div>
      <div className={styles.statBlock}>
        <div
          className={totalSpent > 0 ? styles.statValue : `${styles.statValue} ${styles.statValueEmpty}`}
          data-testid="stat-total-spent"
        >
          {totalSpent > 0
            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalSpent)
            : "—"}
        </div>
        <div className={styles.statLabel}>Total spent</div>
      </div>
    </div>
  );
}

function InsuranceRow({
  insurance,
  onOpen,
}: {
  insurance: InsuranceRecord | null;
  onOpen: (editMode: boolean) => void;
}) {
  const isExpiringSoon = insurance?.expiryDate
    ? isWithin30Days(insurance.expiryDate)
    : false;

  const rowClass = isExpiringSoon
    ? `${styles.insuranceRow} ${styles.insuranceRowWarning}`
    : styles.insuranceRow;

  const iconClass = isExpiringSoon
    ? `${styles.insuranceIcon} ${styles.insuranceIconWarning}`
    : styles.insuranceIcon;

  return (
    <div className={rowClass} data-testid="insurance-row">
      <div className={styles.insuranceRowLeft}>
        <span className={iconClass} aria-hidden="true">
          <ShieldIcon />
        </span>
        {insurance ? (
          <span
            className={isExpiringSoon ? `${styles.insuranceText} ${styles.insuranceTextWarning}` : styles.insuranceText}
            data-testid="insurance-status"
          >
            {insurance.expiryDate
              ? `Expires ${formatShortDate(insurance.expiryDate)}`
              : "Insurance on file"}
          </span>
        ) : (
          <span className={styles.insuranceTextMuted} data-testid="insurance-status">
            No insurance on file
          </span>
        )}
      </div>
      <button
        type="button"
        className={styles.btnInsuranceAction}
        onClick={() => onOpen(!insurance)}
        data-testid={insurance ? "insurance-details-btn" : "insurance-add-btn"}
      >
        {insurance ? "Details →" : "Add →"}
      </button>
    </div>
  );
}

function LogEntryCard({
  entry,
  vehicleId,
}: {
  entry: LogEntrySummary;
  vehicleId: string;
}) {
  const meta = TYPE_META[entry.typeId] ?? TYPE_META["OTHER"];
  const cost = entry.totalCost ? parseFloat(entry.totalCost) : 0;

  return (
    <Link
      href={`/garage/${vehicleId}/log/${entry.id}`}
      className={styles.entryCard}
      data-testid="log-entry-card"
      data-entry-id={entry.id}
    >
      <div className={styles.entryCardTop}>
        <div className={styles.entryCardLeft}>
          <span className={`${styles.typeBadge} ${meta.cls}`} data-testid="entry-type-badge">
            {meta.icon} {meta.label}
          </span>
          <span className={styles.entryTitle} data-testid="entry-title">
            {entry.title}
          </span>
        </div>
        {cost > 0 && (
          <span className={styles.entryCost} data-testid="entry-cost">
            ${cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
      <div className={styles.entryMeta}>
        <span className={styles.entryMetaItem}>
          <CalendarIcon />
          {formatShortDate(entry.date)}
        </span>
        {entry.mileage != null && (
          <span className={styles.entryMetaItem}>
            <OdometerIcon />
            {entry.mileage.toLocaleString()} mi
          </span>
        )}
        {entry.itemCount > 0 && (
          <span className={styles.entryMetaItem}>
            {entry.itemCount} {entry.itemCount === 1 ? "item" : "items"}
          </span>
        )}
        {entry.mediaCount > 0 && (
          <span className={styles.entryMetaItem}>
            <PhotoIcon />
            {entry.mediaCount}
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyHistory({ vehicleId }: { vehicleId: string }) {
  return (
    <div className={styles.stateBlock} data-testid="empty-history">
      <div className={styles.historyEmptyIcon}>
        <ClipboardIcon />
      </div>
      <h3 className={styles.stateHeadline}>No log entries yet</h3>
      <p className={styles.stateBody}>
        Start tracking every service, repair, and modification to build a
        complete history for this vehicle.
      </p>
      <Link
        href={`/garage/${vehicleId}/log/new`}
        className={styles.btnStateAction}
        data-testid="empty-history-cta"
      >
        <PlusIcon />
        Add your first log entry
      </Link>
    </div>
  );
}

function LoadingState() {
  return (
    <div className={styles.stateBlock} data-testid="loading-state">
      <h2 className={styles.stateHeadline}>Loading…</h2>
      <p className={styles.stateBody}>Pulling up this vehicle&apos;s details.</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.stateBlock} data-testid="error-state">
      <h2 className={styles.stateHeadline}>Something went wrong</h2>
      <p className={styles.stateBody}>
        We couldn&apos;t load this vehicle. Our mechanics are on it — try again in a moment.
      </p>
      <button
        type="button"
        className={styles.btnStateAction}
        data-testid="retry-btn"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className={styles.stateBlock} data-testid="not-found-state">
      <h2 className={styles.stateHeadline}>Vehicle not found</h2>
      <p className={styles.stateBody}>
        This vehicle doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link href="/garage" className={styles.btnStateAction} data-testid="back-to-garage-btn">
        Back to Garage
      </Link>
    </div>
  );
}

/* ── Insurance dialog ───────────────────────────────────────────── */

interface InsuranceDialogProps {
  insurance: InsuranceRecord | null;
  initialEditMode: boolean;
  onSave: (input: InsuranceInput) => Promise<void>;
  onClose: () => void;
}

function InsuranceDialog({ insurance, initialEditMode, onSave, onClose }: InsuranceDialogProps) {
  const [editMode, setEditMode] = useState(initialEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [company, setCompany] = useState(insurance?.company ?? "");
  const [policyNumber, setPolicyNumber] = useState(insurance?.policyNumber ?? "");
  const [startDate, setStartDate] = useState(insurance?.startDate ?? "");
  const [expiryDate, setExpiryDate] = useState(insurance?.expiryDate ?? "");
  const [premium, setPremium] = useState(insurance?.premium ?? "");
  const [premiumPeriod, setPremiumPeriod] = useState<string>(insurance?.premiumPeriod ?? "");
  const [towNumber, setTowNumber] = useState(insurance?.towNumber ?? "");
  const [notes, setNotes] = useState(insurance?.notes ?? "");

  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);
    try {
      await onSave({
        company: company.trim() || null,
        policyNumber: policyNumber.trim() || null,
        startDate: startDate || null,
        expiryDate: expiryDate || null,
        premium: premium ? parseFloat(premium) : null,
        premiumPeriod: (premiumPeriod as InsuranceInput["premiumPeriod"]) || null,
        towNumber: towNumber.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch {
      setSaveError("Couldn't save insurance details. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className={styles.dialogBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Insurance details"
      data-testid="insurance-dialog"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>Insurance</h2>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
            aria-label="Close"
            data-testid="dialog-close-btn"
          >
            <CloseIcon />
          </button>
        </div>

        <div className={styles.dialogFields}>
          {editMode ? (
            <>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ins-company">Company</label>
                  <input
                    id="ins-company"
                    className={styles.fieldInput}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. State Farm"
                    data-testid="ins-company"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ins-policy">Policy number</label>
                  <input
                    id="ins-policy"
                    className={styles.fieldInput}
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    placeholder="e.g. SF-12345"
                    data-testid="ins-policy-number"
                  />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ins-start">Start date</label>
                  <input
                    id="ins-start"
                    type="date"
                    className={styles.fieldInput}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="ins-start-date"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ins-expiry">Expiry date</label>
                  <input
                    id="ins-expiry"
                    type="date"
                    className={styles.fieldInput}
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    data-testid="ins-expiry-date"
                  />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ins-premium">Premium</label>
                  <input
                    id="ins-premium"
                    type="number"
                    min="0"
                    step="0.01"
                    className={styles.fieldInput}
                    value={premium}
                    onChange={(e) => setPremium(e.target.value)}
                    placeholder="0.00"
                    data-testid="ins-premium"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ins-period">Period</label>
                  <select
                    id="ins-period"
                    className={styles.fieldInput}
                    value={premiumPeriod}
                    onChange={(e) => setPremiumPeriod(e.target.value)}
                    data-testid="ins-premium-period"
                  >
                    <option value="">— select —</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="BIANNUAL">Biannual</option>
                    <option value="ANNUAL">Annual</option>
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="ins-tow">Tow number</label>
                <input
                  id="ins-tow"
                  className={styles.fieldInput}
                  value={towNumber}
                  onChange={(e) => setTowNumber(e.target.value)}
                  placeholder="e.g. 1-800-555-0100"
                  data-testid="ins-tow-number"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="ins-notes">Notes</label>
                <textarea
                  id="ins-notes"
                  className={`${styles.fieldInput} ${styles.fieldTextarea}`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional coverage details…"
                  data-testid="ins-notes"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.fieldRow}>
                <ReadField label="Company" value={insurance?.company} />
                <ReadField label="Policy number" value={insurance?.policyNumber} />
              </div>
              <div className={styles.fieldRow}>
                <ReadField label="Start date" value={insurance?.startDate ? formatShortDate(insurance.startDate) : null} />
                <ReadField label="Expiry date" value={insurance?.expiryDate ? formatShortDate(insurance.expiryDate) : null} />
              </div>
              <div className={styles.fieldRow}>
                <ReadField
                  label="Premium"
                  value={
                    insurance?.premium
                      ? `$${parseFloat(insurance.premium).toLocaleString("en-US", { minimumFractionDigits: 2 })}${insurance.premiumPeriod ? ` ${PREMIUM_PERIOD_LABELS[insurance.premiumPeriod]}` : ""}`
                      : null
                  }
                />
                <ReadField label="Tow number" value={insurance?.towNumber} />
              </div>
              <ReadField label="Notes" value={insurance?.notes} />
            </>
          )}

          {saveError && (
            <p className={styles.dialogError} data-testid="dialog-save-error">
              {saveError}
            </p>
          )}
        </div>

        <div className={styles.dialogFooter}>
          {editMode ? (
            <>
              <button
                type="button"
                className={styles.btnDialogCancel}
                onClick={() => (insurance ? setEditMode(false) : onClose())}
                data-testid="dialog-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnDialogSave}
                onClick={handleSave}
                disabled={isSaving}
                data-testid="dialog-save-btn"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.btnDialogCancel}
                onClick={onClose}
                data-testid="dialog-close-btn-footer"
              >
                Close
              </button>
              <button
                type="button"
                className={styles.btnDialogEdit}
                onClick={() => setEditMode(true)}
                data-testid="dialog-edit-btn"
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={value ? styles.fieldValue : `${styles.fieldValue} ${styles.fieldValueEmpty}`}>
        {value || "—"}
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isWithin30Days(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(year, month - 1, day).getTime();
  const now = Date.now();
  const diffDays = (target - now) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 30;
}

/* ── Icons ──────────────────────────────────────────────────────── */

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M8.5 4L5.5 7.5l3 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M10 2.5l2.5 2.5L4 13.5H1.5V11L10 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5L2.5 4v4c0 3 2.5 5.5 5.5 6 3-0.5 5.5-3 5.5-6V4L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 5.5h11M5 1.5v2M9 1.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function OdometerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="8" r="5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 8L9.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="3" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="4" width="10" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9h6M9 12h6M9 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function VehicleGlyphIcon() {
  return (
    <svg viewBox="0 0 80 48" fill="none" aria-hidden="true">
      <circle cx="16" cy="36" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="62" cy="36" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M16 36 L30 19 L46 19 L62 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 19 L37 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 19 L41 11 L52 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 13 L33 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
