"use client";

import { CloseIcon, CopyIcon, ShareIcon } from "@/application/components/icons";
import { useShareReportViewModel } from "./useShareReportViewModel";
import styles from "./vehicle-detail.module.css";

export function ShareReportDialog({
  vehicleId,
  onClose,
}: {
  vehicleId: string;
  onClose: () => void;
}) {
  const vm = useShareReportViewModel(vehicleId);

  return (
    <div
      className={styles.dialogBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Share report"
      data-testid="share-report-dialog"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>Share service history</h2>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
            aria-label="Close"
            data-testid="share-dialog-close"
          >
            <CloseIcon />
          </button>
        </div>

        {vm.state === "loading" && (
          <p className={styles.shareDialogBody}>Loading…</p>
        )}

        {vm.state === "no-token" && (
          <div className={styles.shareDialogEmpty}>
            <div className={styles.shareDialogEmptyIcon}>
              <ShareIcon size={22} />
            </div>
            <p className={styles.shareDialogBody}>
              Generate a shareable link to send this vehicle&apos;s service history
              to a mechanic or prospective buyer. No Revlog account required.
            </p>
            <button
              type="button"
              className={styles.btnDialogSave}
              onClick={vm.generateLink}
              data-testid="generate-link-btn"
            >
              Generate link
            </button>
          </div>
        )}

        {vm.state === "has-token" && vm.shareUrl && (
          <div className={styles.shareDialogActive}>
            <div className={styles.shareUrlRow}>
              <span className={styles.shareUrl} data-testid="share-url">
                {vm.shareUrl}
              </span>
              <button
                type="button"
                className={styles.btnCopyLink}
                onClick={vm.copyLink}
                data-testid="copy-link-btn"
              >
                <CopyIcon />
                {vm.copiedConfirm ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className={styles.shareEmailSection}>
              <label htmlFor="share-email" className={styles.fieldLabel}>
                Send to
              </label>
              <div className={styles.shareEmailRow}>
                <input
                  id="share-email"
                  type="email"
                  className={styles.fieldInput}
                  placeholder="mechanic@example.com"
                  value={vm.emailInput}
                  onChange={(e) => vm.setEmailInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") vm.sendEmail(); }}
                  data-testid="share-email-input"
                />
                <button
                  type="button"
                  className={styles.btnDialogSave}
                  onClick={vm.sendEmail}
                  disabled={vm.emailSending || !vm.emailInput.trim()}
                  data-testid="send-email-btn"
                >
                  {vm.emailSending ? "Sending…" : "Send"}
                </button>
              </div>
              {vm.emailSentConfirm && (
                <p className={styles.shareEmailConfirm} data-testid="email-sent-confirm">
                  Sent to {vm.emailSentConfirm}
                </p>
              )}
              {vm.emailError && (
                <p className={styles.dialogError} data-testid="email-error">
                  {vm.emailError}
                </p>
              )}
            </div>

            <div className={styles.dialogFooter}>
              <button
                type="button"
                className={styles.btnDialogDanger}
                onClick={vm.revoke}
                data-testid="revoke-btn"
              >
                Revoke link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
