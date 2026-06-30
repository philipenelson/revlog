"use client";

import Link from "next/link";
import { useEffect, useCallback, type KeyboardEvent } from "react";
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

        {vm.loadState === "ready" && (
          <div className={styles.dangerZone} data-testid="danger-zone">
            <div className={styles.dangerZoneHeader}>
              <h2 className={styles.dangerZoneTitle}>Danger zone</h2>
            </div>
            <p className={styles.dangerZoneBody}>
              Permanently delete this vehicle and all its log entries. This cannot be undone.
            </p>
            <button
              type="button"
              className={styles.btnDanger}
              data-testid="delete-vehicle-btn"
              onClick={vm.openDeleteDialog}
            >
              Delete vehicle
            </button>
          </div>
        )}
      </div>

      {vm.deleteDialogOpen && (
        <DeleteConfirmDialog
          vehicleDisplayName={vm.vehicleDisplayName}
          deleting={vm.deleting}
          deleteError={vm.deleteError}
          onConfirm={vm.handleDelete}
          onClose={vm.closeDeleteDialog}
        />
      )}
    </div>
  );
}

/* ── Delete confirmation dialog ──────────────────────────────────── */

interface DeleteConfirmDialogProps {
  vehicleDisplayName: string;
  deleting: boolean;
  deleteError: string | null;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function DeleteConfirmDialog({ vehicleDisplayName, deleting, deleteError, onConfirm, onClose }: DeleteConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && !deleting) onClose();
    },
    [deleting, onClose],
  );

  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape" && !deleting) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [deleting, onClose]);

  return (
    <div
      className={styles.dialogBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      data-testid="delete-confirm-dialog"
      onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.deleteDialog}>
        <h2 id="delete-dialog-title" className={styles.deleteDialogTitle}>
          Delete vehicle?
        </h2>
        <p className={styles.deleteDialogBody}>
          <strong>{vehicleDisplayName}</strong> and all its log entries, items, media, and insurance will be permanently removed. This cannot be undone.
        </p>

        {deleteError && (
          <p className={styles.deleteDialogError} role="alert" data-testid="delete-error">
            {deleteError}
          </p>
        )}

        <div className={styles.deleteDialogActions}>
          <button
            type="button"
            className={styles.btnGhost}
            data-testid="delete-cancel-btn"
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnDestructive}
            data-testid="delete-confirm-btn"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
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
