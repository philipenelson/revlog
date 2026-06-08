"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth, type Session } from "@/lib/auth/AuthProvider";
import { routeForAccountStatus } from "@/lib/auth/routeForAccountStatus";
import { StatusOrb } from "@/components/StatusOrb";
import { logger } from "@/lib/logger";
import styles from "./verify-email.module.css";

type ScreenState = "waiting" | "verifying" | "verified" | "error";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Scene><StatusOrb state="verifying" /></Scene>}>
      <VerifyEmailScreen />
    </Suspense>
  );
}

function VerifyEmailScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [screenState, setScreenState] = useState<ScreenState>(token ? "verifying" : "waiting");
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;

    apiFetch<Session>(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((session) => {
        setSession(session);
        setScreenState("verified");
        router.push(routeForAccountStatus(session.account.status));
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status < 500)) {
          logger.error("verify-email request failed", { err });
        }
        setScreenState("error");
      });
  }, [token, router, setSession]);

  return (
    <Scene>
      {screenState === "waiting" && <WaitingCopy email={email} />}
      {screenState === "verifying" && <VerifyingCopy />}
      {screenState === "verified" && <VerifiedCopy />}
      {screenState === "error" && <ErrorCopy />}
    </Scene>
  );
}

function Scene({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.scene}>
      <div className={styles.card}>
        <div className={styles.cardLogo}>
          <Logo />
          <div className={styles.wordmark}>
            <span className={styles.wordmarkLight}>Rev</span>
            <span className={styles.wordmarkBold}>log</span>
          </div>
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

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M 11 30 A 14 14 0 1 1 25 30" stroke="var(--surface-subtle)" strokeWidth="3" strokeLinecap="round" />
      <path d="M 11 30 A 14 14 0 1 1 30.1 11" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <line x1="18" y1="18" x2="27.5" y2="13" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="18" r="2.2" fill="var(--accent)" />
      <circle cx="30.1" cy="11" r="1.5" fill="var(--danger)" opacity="0.8" />
    </svg>
  );
}
