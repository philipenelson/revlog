"use client";

import { Suspense } from "react";
import { Logo } from "@/application/components/icons";
import { Wordmark } from "@/application/components/Wordmark";
import { StatusOrb } from "@/application/components/StatusOrb";
import { useVerifyEmailViewModel } from "./useVerifyEmailViewModel";
import styles from "./verify-email.module.css";

export function VerifyEmailScreen() {
  return (
    <Suspense fallback={<Scene><StatusOrb state="verifying" /></Scene>}>
      <VerifyEmailBody />
    </Suspense>
  );
}

function VerifyEmailBody() {
  const vm = useVerifyEmailViewModel();

  if (vm.isVerified) {
    return (
      <Scene>
        <div data-testid="verify-verified">
          <StatusOrb state="verified" />
          <div className={`${styles.eyebrow} ${styles.eyebrowSuccess}`}>You&apos;re verified</div>
          <h1 className={styles.headline}>Taking you to your garage…</h1>
        </div>
      </Scene>
    );
  }

  return (
    <Scene>
      <div data-testid="verify-form">
        <div className={styles.eyebrow}>Almost there</div>
        <h1 className={styles.headline}>Check your inbox</h1>
        <p className={styles.bodyCopy}>
          {vm.email ? (
            <>We sent a 6-digit code to <span className={styles.emailHighlight}>{vm.email}</span>.</>
          ) : (
            "We sent you a 6-digit verification code."
          )}
          {" "}Enter it below — it expires in 10 minutes.
        </p>

        <form className={styles.form} onSubmit={vm.submit} noValidate>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="code">Verification code</label>
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

          {vm.formError && (
            <p className={styles.formError} role="alert" data-testid="verify-error">{vm.formError}</p>
          )}

          <button type="submit" className={styles.btnPrimary} disabled={vm.isSubmitting} data-testid="verify-btn">
            {vm.isSubmitting ? "Verifying…" : "Verify email"}
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
