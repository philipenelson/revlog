"use client";

import { useEffect } from "react";
import { logger } from "@/infrastructure/logging/logger";
import styles from "./onboarding.module.css";

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("onboarding screen crashed", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className={styles.scene}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Something went wrong</div>
        <h1 className={styles.headline}>We stalled setting up your garage</h1>
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
