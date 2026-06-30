"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./CookieConsent.module.css";

const STORAGE_KEY = "cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(
    () => !localStorage.getItem(STORAGE_KEY),
  );

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "acknowledged");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div role="status" aria-live="polite" className={styles.banner} data-testid="cookie-consent">
      <p className={styles.text}>
        We use one cookie to keep you signed in.{" "}
        <Link href="/cookies" className={styles.learnMore}>
          Learn more
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        className={styles.dismissBtn}
        data-testid="cookie-consent-dismiss"
      >
        Got it
      </button>
    </div>
  );
}
