import styles from "./StatusOrb.module.css";

export type StatusOrbState = "verifying" | "verified";

export function StatusOrb({ state }: { state: StatusOrbState }) {
  return (
    <div className={styles.statusOrb}>
      <div aria-hidden="true" className={styles.orbGlow} />
      <svg className={styles.orbRing} viewBox="0 0 100 100" aria-hidden="true">
        <circle className={styles.ringTrack} cx="50" cy="50" r="42" />
        {state === "verifying" ? (
          <circle className={styles.ringArcVerifying} cx="50" cy="50" r="42" />
        ) : (
          <circle className={styles.ringArcVerified} cx="50" cy="50" r="42" transform="rotate(-90 50 50)" />
        )}
      </svg>
      {state === "verified" && (
        <div className={styles.orbIcon}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              className={styles.checkPath}
              d="M7.5 12.4l3 3 6-6.4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
