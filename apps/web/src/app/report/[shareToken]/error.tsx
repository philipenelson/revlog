"use client";

import { useLogScreenCrash } from "@/application/hooks/useLogScreenCrash";
import styles from "@/application/screens/mechanic-printout/mechanic-printout.module.css";

export default function ReportError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useLogScreenCrash("mechanic-printout", error);

  return (
    <div className={styles.scene}>
      <div className={styles.stateBlock}>
        <h1 className={styles.stateTitle}>Something went wrong</h1>
        <p className={styles.stateBody}>We couldn&apos;t load this report. Please try again.</p>
      </div>
    </div>
  );
}
