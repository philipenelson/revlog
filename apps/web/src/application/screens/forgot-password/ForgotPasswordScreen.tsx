"use client";

import { Logo } from "@/application/components/icons";
import { Wordmark } from "@/application/components/Wordmark";
import { useForgotPasswordViewModel } from "./useForgotPasswordViewModel";
import styles from "./forgot-password.module.css";

export function ForgotPasswordScreen() {
  const vm = useForgotPasswordViewModel();

  return (
    <div className={styles.scene}>
      <div className={styles.card}>
        <div className={styles.cardLogo}>
          <Logo size={30} />
          <Wordmark classes={styles} />
        </div>

        <div data-testid="forgot-password-form">
          <div className={styles.eyebrow}>Password help</div>
          <h1 className={styles.headline}>Forgot your password?</h1>
          <p className={styles.bodyCopy}>
            Enter your email and we&apos;ll send you a 6-digit code to set a new password.
          </p>

          <form className={styles.form} onSubmit={vm.submit} noValidate>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                data-testid="email-input"
                className={`${styles.input} ${vm.errors.email ? styles.inputError : ""}`}
                {...vm.field("email")}
              />
              {vm.errors.email && (
                <span className={styles.fieldError} role="alert">{vm.errors.email.message}</span>
              )}
            </div>

            {vm.formError && (
              <p className={styles.formError} role="alert" data-testid="forgot-password-error">{vm.formError}</p>
            )}

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={vm.isSubmitting}
              data-testid="forgot-password-btn"
            >
              {vm.isSubmitting ? "Sending…" : "Send reset code"}
            </button>
          </form>

          <p className={styles.footerRow}>
            <a href="/login" className={styles.footerLink} data-testid="back-to-login-link">
              Back to sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
