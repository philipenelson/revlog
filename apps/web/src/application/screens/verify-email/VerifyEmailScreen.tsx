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

  return (
    <Scene>
      {vm.screenState === "waiting" && <WaitingCopy email={vm.email} />}
      {vm.screenState === "verifying" && <VerifyingCopy />}
      {vm.screenState === "verified" && <VerifiedCopy />}
      {vm.screenState === "error" && <ErrorCopy />}
    </Scene>
  );
}

/* ── Presentational sub-components ──────────────────────────────── */

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

function WaitingCopy({ email }: { email: string | null }) {
  return (
    <div data-testid="verify-waiting">
      <div className={styles.eyebrow}>Almost there</div>
      <h1 className={styles.headline}>Check your inbox</h1>
      <p className={styles.bodyCopy}>
        {email ? (
          <>We sent a verification link to <span className={styles.emailHighlight}>{email}</span>.</>
        ) : (
          "We sent you a verification link."
        )}
        {" "}Click it to confirm your account — the link expires in 24 hours.
      </p>
    </div>
  );
}

function VerifyingCopy() {
  return (
    <div data-testid="verify-verifying">
      <StatusOrb state="verifying" />
      <div className={styles.eyebrow}>One moment</div>
      <h1 className={styles.headline}>Verifying your email…</h1>
    </div>
  );
}

function VerifiedCopy() {
  return (
    <div data-testid="verify-verified">
      <StatusOrb state="verified" />
      <div className={`${styles.eyebrow} ${styles.eyebrowSuccess}`}>You&apos;re verified</div>
      <h1 className={styles.headline}>Taking you to your garage…</h1>
    </div>
  );
}

function ErrorCopy() {
  return (
    <div data-testid="verify-error">
      <div className={styles.eyebrow}>Link expired</div>
      <h1 className={styles.headline}>This link is no longer valid</h1>
      <p className={styles.bodyCopy}>
        Verification links expire after 24 hours, or may have already been used.
        Request a new one to finish setting up your account.
      </p>
      <button type="button" className={styles.btnSecondary} data-testid="resend-btn">
        Resend verification email
      </button>
    </div>
  );
}
