"use client";

import { useLogScreenCrash } from "@/application/hooks/useLogScreenCrash";
import styles from "@/application/screens/verify-email/verify-email.module.css";

export default function VerifyEmailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useLogScreenCrash("verify-email", error);

  return (
    <div className={styles.scene}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Something went wrong</div>
        <h1 className={styles.headline}>We stalled verifying your email</h1>
        <p className={styles.bodyCopy}>
          Our mechanics are on it — try again in a moment.
        </p>
        <button type="button" className={styles.btnPrimary} onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
