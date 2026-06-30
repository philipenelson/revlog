"use client";

import { CloseIcon } from "@/application/components/icons";
import type { InsuranceInput, InsuranceRecord } from "@/domain/types";
import { formatShortDate } from "@/utils/format";
import { formatCurrencyMin2 } from "@/utils/format";
import { useInsuranceDialogViewModel } from "./useInsuranceDialogViewModel";
import styles from "./vehicle-detail.module.css";

const PREMIUM_PERIOD_LABELS: Record<string, string> = {
  MONTHLY: "/ month",
  QUARTERLY: "/ quarter",
  BIANNUAL: "/ 6 months",
  ANNUAL: "/ year",
};

export interface InsuranceDialogProps {
  insurance: InsuranceRecord | null;
  initialEditMode: boolean;
  onSave: (input: InsuranceInput) => Promise<void>;
  onClose: () => void;
}

export function InsuranceDialog({ insurance, initialEditMode, onSave, onClose }: InsuranceDialogProps) {
  const vm = useInsuranceDialogViewModel(insurance, initialEditMode, onSave, onClose);

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
          {vm.editMode ? (
            <>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ins-company">Company</label>
                  <input
                    id="ins-company"
                    className={styles.fieldInput}
                    value={vm.draft.company}
                    onChange={(e) => vm.setField("company", e.target.value)}
                    placeholder="e.g. State Farm"
                    data-testid="ins-company"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ins-policy">Policy number</label>
                  <input
                    id="ins-policy"
                    className={styles.fieldInput}
                    value={vm.draft.policyNumber}
                    onChange={(e) => vm.setField("policyNumber", e.target.value)}
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
                    value={vm.draft.startDate}
                    onChange={(e) => vm.setField("startDate", e.target.value)}
                    data-testid="ins-start-date"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ins-expiry">Expiry date</label>
                  <input
                    id="ins-expiry"
                    type="date"
                    className={styles.fieldInput}
                    value={vm.draft.expiryDate}
                    onChange={(e) => vm.setField("expiryDate", e.target.value)}
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
                    value={vm.draft.premium}
                    onChange={(e) => vm.setField("premium", e.target.value)}
                    placeholder="0.00"
                    data-testid="ins-premium"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ins-period">Period</label>
                  <select
                    id="ins-period"
                    className={styles.fieldInput}
                    value={vm.draft.premiumPeriod}
                    onChange={(e) => vm.setField("premiumPeriod", e.target.value)}
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
                  value={vm.draft.towNumber}
                  onChange={(e) => vm.setField("towNumber", e.target.value)}
                  placeholder="e.g. 1-800-555-0100"
                  data-testid="ins-tow-number"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="ins-notes">Notes</label>
                <textarea
                  id="ins-notes"
                  className={`${styles.fieldInput} ${styles.fieldTextarea}`}
                  value={vm.draft.notes}
                  onChange={(e) => vm.setField("notes", e.target.value)}
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
                      ? `${formatCurrencyMin2(parseFloat(insurance.premium))}${insurance.premiumPeriod ? ` ${PREMIUM_PERIOD_LABELS[insurance.premiumPeriod]}` : ""}`
                      : null
                  }
                />
                <ReadField label="Tow number" value={insurance?.towNumber} />
              </div>
              <ReadField label="Notes" value={insurance?.notes} />
            </>
          )}

          {vm.saveError && (
            <p className={styles.dialogError} data-testid="dialog-save-error">
              {vm.saveError}
            </p>
          )}
        </div>

        <div className={styles.dialogFooter}>
          {vm.editMode ? (
            <>
              <button
                type="button"
                className={styles.btnDialogCancel}
                onClick={vm.handleCancel}
                data-testid="dialog-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnDialogSave}
                onClick={vm.handleSave}
                disabled={vm.isSaving}
                data-testid="dialog-save-btn"
              >
                {vm.isSaving ? "Saving…" : "Save"}
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
                onClick={vm.startEditing}
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
