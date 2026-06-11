"use client";

import { LogEntryFormView } from "./LogEntryFormView";
import { useEditLogEntryViewModel } from "./useEditLogEntryViewModel";
import styles from "./log-entry.module.css";

export function EditLogEntryScreen() {
  const vm = useEditLogEntryViewModel();

  if (vm.isLoading) {
    return (
      <div className={styles.scene}>
        <div className={styles.form}>
          <p className={styles.statusText}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!vm.formState) {
    return (
      <div className={styles.scene}>
        <div className={styles.form}>
          <div className={styles.errorBanner} data-testid="load-error">
            {vm.error ?? "Entry not found"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <LogEntryFormView
        vehicleId={vm.vehicleId}
        mode="edit"
        state={vm.formState}
        onChange={vm.setFormState}
        onSave={vm.handleSave}
        onDelete={vm.openDeleteConfirm}
        isSaving={vm.isSaving}
        error={vm.error}
      />

      {vm.showDeleteConfirm && (
        <div className={styles.overlay} data-testid="delete-dialog">
          <div className={styles.dialog}>
            <div className={styles.dialogTitle}>Delete this log entry?</div>
            <div className={styles.dialogBody}>
              This cannot be undone. The entry and all its items and media will be permanently removed.
            </div>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={vm.closeDeleteConfirm}
                disabled={vm.isDeleting}
                data-testid="cancel-delete-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnConfirmDelete}
                onClick={vm.handleDelete}
                disabled={vm.isDeleting}
                data-testid="confirm-delete-btn"
              >
                {vm.isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
