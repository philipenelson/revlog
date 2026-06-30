"use client";

import { useLogScreenCrash } from "@/application/hooks/useLogScreenCrash";
import styles from "@/application/screens/transfer/transfer.module.css";

export default function TransferError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useLogScreenCrash("transfer", error);

  return (
    <div className={styles.scene}>
      <div className={styles.card}>
        <h2 className={styles.headline}>Something went wrong</h2>
        <p className={styles.body}>
          We couldn&apos;t load this transfer — try again in a moment.
        </p>
        <button type="button" className={styles.btnPrimary} onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
