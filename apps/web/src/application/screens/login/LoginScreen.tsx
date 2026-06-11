"use client";

import { Logo } from "@/application/components/icons";
import { GoogleIcon } from "@/application/components/GoogleIcon";
import { Wordmark } from "@/application/components/Wordmark";
import { useLoginViewModel, type Tab } from "./useLoginViewModel";
import styles from "./login.module.css";

const FEATURES = [
  { title: "Full log entries", body: "Actions, parts, mileage, and media in one place." },
  { title: "Complete service history", body: "Every vehicle's chronological record — owned by you, not the dealer." },
  { title: "Mechanic printouts", body: "Export a formatted PDF for a workshop or potential buyer." },
];

export function LoginScreen() {
  const vm = useLoginViewModel();

  return (
    <div className={styles.root}>
      {/* ── Brand panel ─────────────────────────────────────────── */}
      <aside aria-label="Revlog brand" className={styles.brand}>
        <div aria-hidden="true" className={styles.dotGrid} />
        <div aria-hidden="true" className={styles.tealGlow} />

        <div className={styles.brandContent}>
          <div className={styles.logo}>
            <Logo size={34} />
            <Wordmark classes={styles} />
          </div>

          <h1 className={styles.headline}>
            Every wrench turn.<br />
            Every{" "}
            <span className={styles.headlineAccent}>service.</span>
            <br />
            All yours.
          </h1>

          <p className={styles.tagline}>
            Log maintenance events, track service history,
            and keep your bike&apos;s records — forever.
          </p>
        </div>

        <div aria-hidden="true" className={styles.featureList}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.featureItem}>
              <div className={styles.pip} />
              <div>
                <strong className={styles.featureTitle}>{f.title}</strong>
                <span className={styles.featureBody}>{f.body}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Form panel ──────────────────────────────────────────── */}
      <main className={styles.form}>
        <div className={styles.formInner}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowLine} />
            {vm.tab === "login" ? "Sign in" : "Get started"}
          </div>

          <h2 className={styles.formTitle}>
            {vm.tab === "login" ? "Welcome back" : "Create your account"}
          </h2>

          <div role="tablist" aria-label="Auth mode" className={styles.tabList}>
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={vm.tab === t}
                data-testid={`${t}-tab`}
                onClick={() => vm.selectTab(t)}
                className={`${styles.tab} ${vm.tab === t ? styles.tabActive : ""}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {vm.tab === "login" && (
            <form onSubmit={vm.login.submit} noValidate>
              <Field label="Email">
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  data-testid="email-input"
                  className={`${styles.input} ${vm.login.errors.email ? styles.inputError : ""}`}
                  {...vm.login.field("email")}
                />
                {vm.login.errors.email && (
                  <span className={styles.fieldError}>{vm.login.errors.email.message}</span>
                )}
              </Field>
              <Field label="Password" className={styles.fieldLast}>
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  data-testid="password-input"
                  className={`${styles.input} ${vm.login.errors.password ? styles.inputError : ""}`}
                  {...vm.login.field("password")}
                />
                {vm.login.errors.password && (
                  <span className={styles.fieldError}>{vm.login.errors.password.message}</span>
                )}
              </Field>
              <div className={styles.linkRow}>
                <a href="/forgot-password" className={styles.forgotLink}>Forgot password?</a>
              </div>
              {vm.login.error && (
                <p className={styles.formError} role="alert" data-testid="login-error">
                  {vm.login.error}
                </p>
              )}
              <PrimaryButton type="submit" disabled={vm.login.isSubmitting}>Continue</PrimaryButton>
            </form>
          )}

          {vm.tab === "register" && (
            <form onSubmit={vm.register.submit} noValidate>
              <Field label="Full name">
                <input
                  type="text"
                  placeholder="Your name"
                  autoComplete="name"
                  data-testid="name-input"
                  className={`${styles.input} ${vm.register.errors.fullName ? styles.inputError : ""}`}
                  {...vm.register.field("fullName")}
                />
                {vm.register.errors.fullName && (
                  <span className={styles.fieldError}>{vm.register.errors.fullName.message}</span>
                )}
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  data-testid="email-input"
                  className={`${styles.input} ${vm.register.errors.email ? styles.inputError : ""}`}
                  {...vm.register.field("email")}
                />
                {vm.register.errors.email && (
                  <span className={styles.fieldError}>{vm.register.errors.email.message}</span>
                )}
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  placeholder="Create a password"
                  autoComplete="new-password"
                  data-testid="password-input"
                  className={`${styles.input} ${vm.register.errors.password ? styles.inputError : ""}`}
                  {...vm.register.field("password")}
                />
                {vm.register.errors.password && (
                  <span className={styles.fieldError}>{vm.register.errors.password.message}</span>
                )}
              </Field>
              <Field label="Confirm password" className={styles.fieldLast}>
                <input
                  type="password"
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  data-testid="confirm-password-input"
                  className={`${styles.input} ${vm.register.errors.confirmPassword ? styles.inputError : ""}`}
                  {...vm.register.field("confirmPassword")}
                />
                {vm.register.errors.confirmPassword && (
                  <span className={styles.fieldError}>{vm.register.errors.confirmPassword.message}</span>
                )}
              </Field>
              {vm.register.error && (
                <p className={styles.formError} role="alert" data-testid="register-error">
                  {vm.register.error}
                </p>
              )}
              <PrimaryButton type="submit" disabled={vm.register.isSubmitting}>Create account</PrimaryButton>
            </form>
          )}

          <div className={styles.divider}>
            <div className={styles.dividerLine} />
            <span className={styles.dividerText}>OR</span>
            <div className={styles.dividerLine} />
          </div>

          <button type="button" className={styles.googleBtn}>
            <GoogleIcon />
            Continue with Google
          </button>

          <p className={styles.footer}>
            By continuing you agree to our{" "}
            <a href="#" className={styles.footerLink}>Terms of Service</a>
            {" "}and{" "}
            <a href="#" className={styles.footerLink}>Privacy Policy</a>.
          </p>
        </div>
      </main>
    </div>
  );
}

/* ── Presentational sub-components ────────────────────────────────── */

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.field} ${className ?? ""}`}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button type={type} disabled={disabled} className={styles.primaryBtn}>
      {children}
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <path
          d="M2.5 7.5h10M8.5 4.5l3 3-3 3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
