"use client";

import Link from "next/link";
import { BackArrowIcon } from "@/application/components/icons";
import { FormField } from "@/application/components/FormField";
import { useEditVehicleViewModel } from "./useEditVehicleViewModel";
import styles from "./edit-vehicle.module.css";

export function EditVehicleScreen() {
  const vm = useEditVehicleViewModel();

  if (vm.loadState === "not-found") return <NotFoundState />;
  if (vm.loadState === "error") return <ErrorState />;

  return (
    <div className={styles.scene}>
      <header className={styles.topbar}>
        <Link href={`/garage/${vm.vehicleId}`} className={styles.backLink}>
          <BackArrowIcon />
          Back to vehicle
        </Link>
        <h1 className={styles.topbarTitle}>Edit vehicle</h1>
        <div className={styles.topbarSpacer} />
      </header>

      <div className={styles.page}>
        <div className={styles.formCard}>
          {vm.loadState === "loading" ? (
            <div className={styles.loadingSkeleton} data-testid="loading-skeleton" />
          ) : (
            <form onSubmit={vm.handleSubmit} noValidate data-testid="edit-vehicle-form">
              <FormField label="Nickname" id="fNickname" optional classes={styles}>
                <input
                  id="fNickname"
                  type="text"
                  placeholder="e.g. The Daily"
                  autoComplete="off"
                  className={styles.fieldInput}
                  data-testid="nickname-input"
                  value={vm.fields.nickname}
                  onChange={vm.updateField("nickname")}
                />
              </FormField>

              <div className={styles.fieldRow}>
                <FormField label="Make" id="fMake" error={vm.errors.make} classes={styles}>
                  <input
                    id="fMake"
                    type="text"
                    placeholder="Triumph"
                    autoComplete="off"
                    className={`${styles.fieldInput} ${vm.errors.make ? styles.fieldInputError : ""}`}
                    data-testid="make-input"
                    value={vm.fields.make}
                    onChange={vm.updateField("make")}
                  />
                </FormField>
                <FormField label="Model" id="fModel" error={vm.errors.model} classes={styles}>
                  <input
                    id="fModel"
                    type="text"
                    placeholder="Street Triple RS"
                    autoComplete="off"
                    className={`${styles.fieldInput} ${vm.errors.model ? styles.fieldInputError : ""}`}
                    data-testid="model-input"
                    value={vm.fields.model}
                    onChange={vm.updateField("model")}
                  />
                </FormField>
              </div>

              <div className={styles.fieldRow}>
                <FormField label="Year" id="fYear" error={vm.errors.year} classes={styles}>
                  <input
                    id="fYear"
                    type="text"
                    inputMode="numeric"
                    placeholder="2021"
                    autoComplete="off"
                    className={`${styles.fieldInput} ${vm.errors.year ? styles.fieldInputError : ""}`}
                    data-testid="year-input"
                    value={vm.fields.year}
                    onChange={vm.updateField("year")}
                  />
                </FormField>
                <FormField label="Current mileage" id="fMileage" error={vm.errors.mileage} classes={styles}>
                  <div className={styles.inputSuffixWrap}>
                    <input
                      id="fMileage"
                      type="text"
                      inputMode="numeric"
                      placeholder="14,230"
                      autoComplete="off"
                      className={`${styles.fieldInput} ${vm.errors.mileage ? styles.fieldInputError : ""}`}
                      data-testid="mileage-input"
                      value={vm.fields.mileage}
                      onChange={vm.updateField("mileage")}
                    />
                    <span className={styles.inputSuffix}>mi</span>
                  </div>
                </FormField>
              </div>

              {vm.submitError && (
                <span className={styles.submitError} role="alert" data-testid="submit-error">
                  {vm.submitError}
                </span>
              )}

              <div className={styles.formActions}>
                <Link href={`/garage/${vm.vehicleId}`} className={styles.btnGhost} data-testid="cancel-btn">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  data-testid="save-btn"
                  disabled={vm.submitting}
                >
                  {vm.submitting ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Presentational sub-components ──────────────────────────────── */

function NotFoundState() {
  return (
    <div className={styles.stateScene}>
      <p className={styles.stateMessage}>Vehicle not found.</p>
      <Link href="/garage" className={styles.stateLink}>Back to garage</Link>
    </div>
  );
}

function ErrorState() {
  return (
    <div className={styles.stateScene}>
      <p className={styles.stateMessage}>Something went wrong loading this vehicle.</p>
      <Link href="/garage" className={styles.stateLink}>Back to garage</Link>
    </div>
  );
}
