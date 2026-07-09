"use client";

import { Suspense } from "react";
import { Logo } from "@/application/components/icons";
import { Wordmark } from "@/application/components/Wordmark";
import { StatusOrb } from "@/application/components/StatusOrb";
import { useResetPasswordViewModel } from "./useResetPasswordViewModel";
import styles from "./reset-password.module.css";

export function ResetPasswordScreen() {
  return (
    <Suspense fallback={<Scene><StatusOrb state="verifying" /></Scene>}>
      <ResetPasswordBody />
    </Suspense>
  );
}

function ResetPasswordBody() {
  const vm = useResetPasswordViewModel();

  if (vm.isReset) {
    return (
      <Scene>
        <div data-testid="reset-done">
          <StatusOrb state="verified" />
          <div className={`${styles.eyebrow} ${styles.eyebrowSuccess}`}>Password reset</div>
          <h1 className={styles.headline}>Taking you to your garage…</h1>
        </div>
      </Scene>
    );
  }

  return (
    <Scene>
      <div data-testid="reset-form">
        <div className={styles.eyebrow}>Almost there</div>
        <h1 className={styles.headline}>Set a new password</h1>
        <p className={styles.bodyCopy}>
          {vm.email ? (
            <>We sent a 6-digit code to <span className={styles.emailHighlight}>{vm.email}</span>.</>
          ) : (
            "We sent you a 6-digit reset code."
          )}
          {" "}Enter it below with a new password — the code expires in 10 minutes.
        </p>

        <form className={styles.form} onSubmit={vm.submit} noValidate>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="code">Reset code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              data-testid="code-input"
              className={`${styles.input} ${styles.codeInput} ${vm.errors.code ? styles.inputError : ""}`}
              {...vm.field("code")}
            />
            {vm.errors.code && (
              <span className={styles.fieldError} role="alert">{vm.errors.code.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              data-testid="new-password-input"
              className={`${styles.input} ${vm.errors.newPassword ? styles.inputError : ""}`}
              {...vm.field("newPassword")}
            />
            {vm.errors.newPassword && (
              <span className={styles.fieldError} role="alert">{vm.errors.newPassword.message}</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              data-testid="confirm-password-input"
              className={`${styles.input} ${vm.errors.confirmPassword ? styles.inputError : ""}`}
              {...vm.field("confirmPassword")}
            />
            {vm.errors.confirmPassword && (
              <span className={styles.fieldError} role="alert" data-testid="confirm-password-error">
                {vm.errors.confirmPassword.message}
              </span>
            )}
          </div>

          {vm.formError && (
            <p className={styles.formError} role="alert" data-testid="reset-error">{vm.formError}</p>
          )}

          <button type="submit" className={styles.btnPrimary} disabled={vm.isSubmitting} data-testid="reset-btn">
            {vm.isSubmitting ? "Resetting…" : "Reset password"}
          </button>
        </form>

        {vm.resendState === "sent" ? (
          <p className={styles.resendSent} data-testid="resend-sent">
            A new code is on its way. Check your inbox.
          </p>
        ) : (
          <p className={styles.resendRow}>
            Didn&apos;t get it?{" "}
            <button
              type="button"
              className={styles.resendLink}
              onClick={vm.onResend}
              disabled={vm.resendState === "sending"}
              data-testid="resend-btn"
            >
              Resend code
            </button>
          </p>
        )}
      </div>
    </Scene>
  );
}

/* ── Presentational shell ───────────────────────────────────────── */

function Scene({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.scene}>
      <div className={styles.card}>
        <div className={styles.cardLogo}>
          <Logo size={30} />
          <Wordmark classes={styles} />
        </div>
        {children}
      </div>
    </div>
  );
}
