"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import styles from "./garage.module.css";

export default function GarageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("garage screen crashed", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className={styles.scene}>
      <div className={styles.emptyState}>
        <h2 className={styles.emptyHeadline}>Something went wrong</h2>
        <p className={styles.emptyBody}>
          We couldn&apos;t load your garage — our mechanics are on it. Try again in a moment.
        </p>
        <button type="button" className={styles.btnPrimary} onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
