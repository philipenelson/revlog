"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ClipboardIcon,
  EditIcon,
  OdometerIcon,
  PhotoIcon,
  PlusIcon,
  ShareIcon,
  ShieldIcon,
  VehicleGlyphIcon,
} from "@/application/components/icons";
import { Wordmark } from "@/application/components/Wordmark";
import type { InsuranceRecord, LogEntrySummary, PendingTransfer, VehicleDetail } from "@maintenance-log/api-client";
import { formatCurrency2, formatCurrencyWhole, formatShortDate } from "@/utils/format";
import { isWithin30Days } from "@/utils/date";
import { useVehicleDetailViewModel } from "./useVehicleDetailViewModel";
import { InsuranceDialog } from "./InsuranceDialog";
import { ShareReportDialog } from "./ShareReportDialog";
import styles from "./vehicle-detail.module.css";

/* ── Display constants ──────────────────────────────────────────── */

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

/* ── Screen ─────────────────────────────────────────────────────── */

export function VehicleDetailScreen() {
  const vm = useVehicleDetailViewModel();
  const { vehicle, vehicleId, displayName } = vm;

  return (
    <>
      {vehicle && <title>{`Revlog — ${displayName}`}</title>}

      <div className={styles.scene} data-testid="vehicle-detail-page">
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <Link href="/garage" className={styles.backLink} data-testid="back-link">
              <ChevronLeftIcon />
              Garage
            </Link>
            <Wordmark classes={styles} />
          </div>
          <div className={styles.topbarRight}>
            <button
              type="button"
              className={styles.btnOutline}
              onClick={vm.openShareReport}
              data-testid="share-report-btn"
            >
              <ShareIcon />
              Share report
            </button>
            {!vehicle?.transferPending && (
              <>
                <Link
                  href={`/garage/${vehicleId}/edit`}
                  className={styles.btnOutline}
                  data-testid="edit-btn"
                >
                  <EditIcon />
                  Edit
                </Link>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={vm.openTransferDialog}
                  data-testid="transfer-btn"
                >
                  Transfer
                </button>
                <Link
                  href={`/garage/${vehicleId}/log/new`}
                  className={styles.btnPrimary}
                  data-testid="new-log-entry-btn"
                >
                  <PlusIcon size={12} />
                  Log entry
                </Link>
              </>
            )}
          </div>
        </header>

        {vm.loadState === "loading" && <LoadingState />}
        {vm.loadState === "error" && <ErrorState onRetry={vm.retry} />}
        {vm.loadState === "not-found" && <NotFoundState />}

        {vm.loadState === "loaded" && vehicle && (
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

              {vehicle.transferPending && vehicle.pendingTransfer && (
                <TransferPendingBanner
                  pendingTransfer={vehicle.pendingTransfer}
                  onCancel={vm.openCancelTransferDialog}
                />
              )}

              <InsuranceRow
                insurance={vehicle.insurance}
                onOpen={vm.openInsurance}
              />

              <section aria-label="Service history">
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Service history</h2>
                  <select
                    className={styles.filterSelect}
                    value={vm.typeFilter}
                    onChange={(e) => vm.setTypeFilter(e.target.value)}
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

                {vm.filteredEntries.length === 0 ? (
                  <EmptyHistory vehicleId={vehicleId} />
                ) : (
                  <div className={styles.entryList} data-testid="log-entry-list">
                    {vm.filteredEntries.map((entry) => (
                      <LogEntryCard
                        key={entry.id}
                        entry={entry}
                        vehicleId={vehicleId}
                        locked={vehicle.transferPending}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>

      {vm.insuranceOpen && vehicle && (
        <InsuranceDialog
          insurance={vehicle.insurance}
          initialEditMode={vm.insuranceEditMode}
          onSave={vm.handleInsuranceSave}
          onClose={vm.closeInsurance}
        />
      )}

      {vm.shareReportOpen && (
        <ShareReportDialog
          vehicleId={vehicleId}
          onClose={vm.closeShareReport}
        />
      )}

      {vm.transferDialogOpen && (
        <TransferDialog
          vehicleDisplayName={displayName}
          onSubmit={vm.handleInitiateTransfer}
          onClose={vm.closeTransferDialog}
        />
      )}

      {vm.cancelTransferDialogOpen && (
        <CancelTransferDialog
          onConfirm={vm.handleCancelTransfer}
          onClose={vm.closeCancelTransferDialog}
        />
      )}
    </>
  );
}

/* ── Presentational sub-components ──────────────────────────────── */

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
          {totalSpent > 0 ? formatCurrencyWhole(totalSpent) : "—"}
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

function TransferPendingBanner({
  pendingTransfer,
  onCancel,
}: {
  pendingTransfer: PendingTransfer;
  onCancel: () => void;
}) {
  return (
    <div className={styles.transferBanner} data-testid="transfer-pending-banner">
      <div className={styles.transferBannerText}>
        <span className={styles.transferBannerHeadline}>
          Transfer pending
        </span>
        <span className={styles.transferBannerDetail}>
          Awaiting {pendingTransfer.recipientEmail} — expires{" "}
          {formatShortDate(pendingTransfer.expiresAt)}. This vehicle is locked until the transfer resolves.
        </span>
      </div>
      <button
        type="button"
        className={styles.btnDanger}
        onClick={onCancel}
        data-testid="cancel-transfer-btn"
      >
        Cancel transfer
      </button>
    </div>
  );
}

function TransferDialog({
  vehicleDisplayName,
  onSubmit,
  onClose,
}: {
  vehicleDisplayName: string;
  onSubmit: (email: string) => Promise<void>;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(email.trim().toLowerCase());
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.dialogBackdrop} onClick={onClose} data-testid="transfer-dialog">
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>Transfer {vehicleDisplayName}</h2>
          <button type="button" className={styles.dialogClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className={styles.stateBody}>
          Enter the email address of the Revlog user you want to transfer this
          vehicle and its full service history to. They will receive an email to
          accept or decline.
        </p>
        <form onSubmit={handleSubmit}>
          <div className={styles.dialogFields}>
            <div className={styles.field}>
              <label htmlFor="transfer-email" className={styles.fieldLabel}>
                Recipient email
              </label>
              <input
                id="transfer-email"
                type="email"
                className={styles.fieldInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="their@email.com"
                required
                autoFocus
                data-testid="transfer-email-input"
              />
            </div>
            {error && <p className={styles.dialogError}>{error}</p>}
          </div>
          <div className={styles.dialogFooter}>
            <button
              type="button"
              className={styles.btnDialogCancel}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnDialogSave}
              disabled={submitting || !email.trim()}
              data-testid="transfer-submit-btn"
            >
              {submitting ? "Sending…" : "Send transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CancelTransferDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.dialogBackdrop} onClick={onClose} data-testid="cancel-transfer-dialog">
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>Cancel transfer?</h2>
          <button type="button" className={styles.dialogClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className={styles.stateBody}>
          The recipient will be notified and the vehicle will be unlocked. You
          can initiate a new transfer at any time.
        </p>
        {error && <p className={styles.dialogError}>{error}</p>}
        <div className={styles.dialogFooter}>
          <button
            type="button"
            className={styles.btnDialogCancel}
            onClick={onClose}
          >
            Keep transfer
          </button>
          <button
            type="button"
            className={styles.btnDialogDanger}
            onClick={handleConfirm}
            disabled={submitting}
            data-testid="confirm-cancel-transfer-btn"
          >
            {submitting ? "Cancelling…" : "Yes, cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogEntryCard({
  entry,
  vehicleId,
  locked = false,
}: {
  entry: LogEntrySummary;
  vehicleId: string;
  locked?: boolean;
}) {
  const meta = TYPE_META[entry.typeId] ?? TYPE_META["OTHER"];
  const cost = entry.totalCost ? parseFloat(entry.totalCost) : 0;

  const cardContent = (
    <>
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
            {formatCurrency2(cost)}
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
    </>
  );

  if (locked) {
    return (
      <div
        className={styles.entryCardLocked}
        data-testid="log-entry-card"
        data-entry-id={entry.id}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      href={`/garage/${vehicleId}/log/${entry.id}`}
      className={styles.entryCard}
      data-testid="log-entry-card"
      data-entry-id={entry.id}
    >
      {cardContent}
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
        <PlusIcon size={12} />
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
