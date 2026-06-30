"use client";

import type { PrintoutLogEntry, PrintoutLogItem } from "@/model/types";
import { formatShortDate, formatCurrency2, formatCurrencyWhole } from "@/utils/format";
import { useMechanicPrintoutViewModel } from "./useMechanicPrintoutViewModel";
import styles from "./mechanic-printout.module.css";

const TYPE_LABELS: Record<string, string> = {
  MAINTENANCE: "Maintenance",
  REPAIR: "Repair",
  MODIFICATION: "Modification",
  INSPECTION: "Inspection",
  INCIDENT: "Incident",
  EVENT: "Event",
  OTHER: "Other",
};

const TYPE_CSS: Record<string, string> = {
  MAINTENANCE: styles.typeMaintenance,
  REPAIR:      styles.typeRepair,
  MODIFICATION:styles.typeModification,
  INSPECTION:  styles.typeInspection,
  INCIDENT:    styles.typeIncident,
  EVENT:       styles.typeEvent,
  OTHER:       styles.typeOther,
};

export function MechanicPrintoutScreen({ shareToken }: { shareToken: string }) {
  const vm = useMechanicPrintoutViewModel(shareToken);

  return (
    <div className={styles.scene} data-testid="printout-page">

      {/* Screen bar — hidden on print */}
      <div className={styles.screenBar}>
        <div className={styles.wordmark}>
          <span className={styles.wordmarkLight}>Rev</span>
          <span className={styles.wordmarkBold}>log</span>
        </div>
        <button
          type="button"
          className={styles.btnPrint}
          onClick={() => window.print()}
        >
          <PrintIcon />
          Print / Save as PDF
        </button>
      </div>

      {vm.loadState === "loading" && (
        <div className={styles.stateBlock} data-testid="loading-state">
          <p className={styles.stateBody}>Loading report…</p>
        </div>
      )}

      {vm.loadState === "not-found" && (
        <div className={styles.stateBlock} data-testid="not-found-state">
          <div className={styles.stateIcon}>
            <RevokedIcon />
          </div>
          <h1 className={styles.stateTitle}>This report is no longer available</h1>
          <p className={styles.stateBody}>
            The owner has revoked this service history link. Contact them directly if you need access.
          </p>
        </div>
      )}

      {vm.loadState === "error" && (
        <div className={styles.stateBlock} data-testid="error-state">
          <h1 className={styles.stateTitle}>Something went wrong</h1>
          <p className={styles.stateBody}>We couldn&apos;t load this report. Please try again.</p>
        </div>
      )}

      {vm.loadState === "loaded" && vm.printout && (
        <div className={styles.document} data-testid="printout-document">

          {/* Document header */}
          <div className={styles.docHeader}>
            <div className={styles.docLogo}>
              <span className={styles.docLogoLight}>Rev</span>
              <span className={styles.docLogoBold}>log</span>
            </div>
            <div className={styles.docMetaRight}>
              <div className={styles.docReportLabel}>Vehicle Service History</div>
              <div className={styles.docGenDate}>Generated {vm.generatedDate}</div>
            </div>
          </div>

          {/* Vehicle identity */}
          <div className={styles.vehicleIdentity}>
            {vm.printout.vehicle.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={vm.printout.vehicle.photoUrl}
                alt={vm.displayName}
                className={styles.vehiclePhoto}
                data-testid="vehicle-photo"
              />
            ) : (
              <div className={styles.vehicleGlyph} data-testid="vehicle-glyph">
                <MotorcycleGlyph />
              </div>
            )}
            <div className={styles.vehicleInfoMain}>
              <div className={styles.vehicleDisplayName} data-testid="vehicle-display-name">
                {vm.displayName}
              </div>
              <div className={styles.vehicleMeta} data-testid="vehicle-meta">
                {vm.printout.vehicle.make} · {vm.printout.vehicle.model} · {vm.printout.vehicle.year}
              </div>
              <div className={styles.statsRow}>
                <div className={styles.vstat}>
                  <div className={styles.vstatVal} data-testid="stat-odometer">
                    {vm.printout.vehicle.mileage.toLocaleString()} mi
                  </div>
                  <div className={styles.vstatLbl}>Odometer</div>
                </div>
                <div className={styles.vstat}>
                  <div className={styles.vstatVal} data-testid="stat-entry-count">
                    {vm.printout.stats.logEntryCount}
                  </div>
                  <div className={styles.vstatLbl}>Log entries</div>
                </div>
                {vm.printout.stats.lastLoggedAt && (
                  <div className={styles.vstat}>
                    <div className={styles.vstatVal} data-testid="stat-last-logged">
                      {formatShortDate(vm.printout.stats.lastLoggedAt)}
                    </div>
                    <div className={styles.vstatLbl}>Last logged</div>
                  </div>
                )}
                <div className={styles.vstat}>
                  <div className={styles.vstatVal} data-testid="stat-total-spent">
                    {parseFloat(vm.printout.stats.totalSpent) > 0
                      ? formatCurrencyWhole(parseFloat(vm.printout.stats.totalSpent))
                      : "—"}
                  </div>
                  <div className={styles.vstatLbl}>Total spent</div>
                </div>
              </div>
            </div>
          </div>

          {/* Service history */}
          <div className={styles.sectionTitle}>Service History</div>

          {vm.printout.logEntries.map((entry) => (
            <LogEntryCard key={entry.id} entry={entry} />
          ))}

          {vm.printout.logEntries.length === 0 && (
            <p className={styles.stateBody} data-testid="no-entries">
              No service history on record.
            </p>
          )}

          {/* Document footer */}
          <div className={styles.docFooter}>
            <span>Generated by Revlog · revlog.io</span>
            <span>{vm.generatedDate}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LogEntryCard({ entry }: { entry: PrintoutLogEntry }) {
  const typeLabel = TYPE_LABELS[entry.typeId] ?? "Other";
  const typeCls = TYPE_CSS[entry.typeId] ?? styles.typeOther;
  const entryTotal = computeEntryTotal(entry.items);

  return (
    <div className={styles.entry} data-testid="printout-entry">
      <div className={styles.entryHead}>
        <div className={styles.entryTypeLine}>
          <span className={`${styles.entryTypeBadge} ${typeCls}`}>{typeLabel}</span>
          <span className={styles.entryDate}>{formatShortDate(entry.date)}</span>
          {entry.mileage != null && (
            <span className={styles.entryMileage}>· {entry.mileage.toLocaleString()} mi</span>
          )}
        </div>
      </div>
      <div className={styles.entryTitle}>{entry.title}</div>

      {entry.items.length > 0 && (
        <>
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th className={styles.itemColWide}>Item</th>
                <th>Category</th>
                <th className={styles.numCol}>Qty</th>
                <th className={styles.numCol}>Unit cost</th>
                <th className={styles.numCol}>Total</th>
              </tr>
            </thead>
            <tbody>
              {entry.items.map((item, i) => {
                const lineTotal = computeLineTotal(item);
                return (
                  <tr key={i}>
                    <td>{item.description}</td>
                    <td>{item.categoryId}</td>
                    <td className={styles.numCol}>{item.quantity ?? "—"}</td>
                    <td className={styles.numCol}>
                      {item.unitCost ? formatCurrency2(parseFloat(item.unitCost)) : "—"}
                    </td>
                    <td className={styles.numCol}>
                      {lineTotal ? formatCurrency2(lineTotal) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {entryTotal > 0 && (
            <div className={styles.entryTotal}>
              <span>Total</span>
              <span>{formatCurrency2(entryTotal)}</span>
            </div>
          )}
        </>
      )}

      {entry.notes && (
        <div className={styles.entryNotes} data-testid="entry-notes">
          <span className={styles.notesLabel}>Notes</span>
          {entry.notes}
        </div>
      )}
    </div>
  );
}

function computeLineTotal(item: PrintoutLogItem): number | null {
  if (item.quantity == null || item.unitCost == null) return null;
  return parseFloat(item.quantity) * parseFloat(item.unitCost);
}

function computeEntryTotal(items: PrintoutLogItem[]): number {
  return items.reduce((sum, item) => {
    const t = computeLineTotal(item);
    return t != null ? sum + t : sum;
  }, 0);
}

function PrintIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 4V2.5h5V4M4.5 11v.5h5V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="4.5" y="8" width="5" height="3.5" rx=".5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function RevokedIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7l2-2m0 4l-2-2m10-2l-2 2m2 0l-2-2M5 5l4 4M9 5l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MotorcycleGlyph() {
  return (
    <svg viewBox="0 0 80 48" fill="none" aria-hidden="true">
      <circle cx="16" cy="36" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="62" cy="36" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M16 36 L30 19 L46 19 L62 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 19 L37 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 19 L41 11 L52 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="36" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="62" cy="36" r="4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
