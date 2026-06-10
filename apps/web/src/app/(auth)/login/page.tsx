"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, loginSchema, type RegisterInput, type LoginInput } from "@maintenance-log/domain";
import { googleBrand } from "@maintenance-log/ui-tokens/colors";
import { ApiError } from "@/model/errors";
import * as authService from "@/model/services/authService";
import { useAuth } from "@/application/providers/AuthProvider";
import { routeForAccountStatus } from "@/application/navigation/routeForAccountStatus";
import { logger } from "@/infrastructure/logging/logger";
import styles from "./login.module.css";

const SIGN_IN_USER_ERROR =
  "Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet.";
const REGISTER_USER_ERROR = "Couldn't create your account. Check your details and try again.";
const SERVICE_ERROR = "We stalled. Our mechanics are on it — try again in a moment.";

type Tab = "login" | "register";

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("login");
  const router = useRouter();
  const { session, isRestoring, setSession } = useAuth();

  // UC-AUTH-5 — an already-authenticated visitor (silent refresh restored a
  // session on mount, see ADR 0017/UC-AUTH-7) should never see this form; route
  // them onward exactly as a fresh sign-in would. Wait for isRestoring to settle
  // first, or every visitor would flash through the form before being routed away.
  useEffect(() => {
    if (isRestoring || !session) return;
    router.replace(routeForAccountStatus(session.account.status));
  }, [session, isRestoring, router]);

  const [loginError, setLoginError] = useState<string | null>(null);
  const {
    register: loginField,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const [registerError, setRegisterError] = useState<string | null>(null);
  const {
    register: registerField,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: registerErrors, isSubmitting: isRegisterSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  function selectTab(next: Tab) {
    setTab(next);
    setLoginError(null);
    setRegisterError(null);
  }

  async function onLoginSubmit(data: LoginInput) {
    setLoginError(null);
    try {
      const session = await authService.login(data);
      setSession(session);
      router.push(routeForAccountStatus(session.account.status));
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setLoginError(SIGN_IN_USER_ERROR);
      } else {
        logger.error("login request failed", { err });
        setLoginError(SERVICE_ERROR);
      }
    }
  }

  async function onRegisterSubmit(data: RegisterInput) {
    setRegisterError(null);
    try {
      await authService.register(data);
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setRegisterError(REGISTER_USER_ERROR);
      } else {
        logger.error("registration request failed", { err });
        setRegisterError(SERVICE_ERROR);
      }
    }
  }

  return (
    <div className={styles.root}>
      {/* ── Brand panel ─────────────────────────────────────────── */}
      <aside aria-label="Revlog brand" className={styles.brand}>
        <div aria-hidden="true" className={styles.dotGrid} />
        <div aria-hidden="true" className={styles.tealGlow} />

        <div className={styles.brandContent}>
          <div className={styles.logo}>
            <svg width="34" height="34" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <path
                d="M 11 30 A 14 14 0 1 1 25 30"
                stroke="var(--surface-subtle)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M 11 30 A 14 14 0 1 1 30.1 11"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line x1="18" y1="18" x2="27.5" y2="13" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="18" cy="18" r="2.2" fill="var(--accent)" />
              <circle cx="30.1" cy="11" r="1.5" fill="var(--danger)" opacity="0.8" />
            </svg>
            <div className={styles.wordmark}>
              <span className={styles.wordmarkLight}>Rev</span>
              <span className={styles.wordmarkBold}>log</span>
            </div>
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
          {[
            { title: "Full log entries", body: "Actions, parts, mileage, and media in one place." },
            { title: "Complete service history", body: "Every vehicle's chronological record — owned by you, not the dealer." },
            { title: "Mechanic printouts", body: "Export a formatted PDF for a workshop or potential buyer." },
          ].map((f) => (
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
            {tab === "login" ? "Sign in" : "Get started"}
          </div>

          <h2 className={styles.formTitle}>
            {tab === "login" ? "Welcome back" : "Create your account"}
          </h2>

          <div role="tablist" aria-label="Auth mode" className={styles.tabList}>
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                data-testid={`${t}-tab`}
                onClick={() => selectTab(t)}
                className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === "login" && (
            <form onSubmit={handleLoginSubmit(onLoginSubmit)} noValidate>
              <Field label="Email">
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  data-testid="email-input"
                  className={`${styles.input} ${loginErrors.email ? styles.inputError : ""}`}
                  {...loginField("email")}
                />
                {loginErrors.email && (
                  <span className={styles.fieldError}>{loginErrors.email.message}</span>
                )}
              </Field>
              <Field label="Password" className={styles.fieldLast}>
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  data-testid="password-input"
                  className={`${styles.input} ${loginErrors.password ? styles.inputError : ""}`}
                  {...loginField("password")}
                />
                {loginErrors.password && (
                  <span className={styles.fieldError}>{loginErrors.password.message}</span>
                )}
              </Field>
              <div className={styles.linkRow}>
                <a href="/forgot-password" className={styles.forgotLink}>Forgot password?</a>
              </div>
              {loginError && (
                <p className={styles.formError} role="alert" data-testid="login-error">
                  {loginError}
                </p>
              )}
              <PrimaryButton type="submit" disabled={isLoginSubmitting}>Continue</PrimaryButton>
            </form>
          )}

          {tab === "register" && (
            <form onSubmit={handleRegisterSubmit(onRegisterSubmit)} noValidate>
              <Field label="Full name">
                <input
                  type="text"
                  placeholder="Your name"
                  autoComplete="name"
                  data-testid="name-input"
                  className={`${styles.input} ${registerErrors.fullName ? styles.inputError : ""}`}
                  {...registerField("fullName")}
                />
                {registerErrors.fullName && (
                  <span className={styles.fieldError}>{registerErrors.fullName.message}</span>
                )}
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  data-testid="email-input"
                  className={`${styles.input} ${registerErrors.email ? styles.inputError : ""}`}
                  {...registerField("email")}
                />
                {registerErrors.email && (
                  <span className={styles.fieldError}>{registerErrors.email.message}</span>
                )}
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  placeholder="Create a password"
                  autoComplete="new-password"
                  data-testid="password-input"
                  className={`${styles.input} ${registerErrors.password ? styles.inputError : ""}`}
                  {...registerField("password")}
                />
                {registerErrors.password && (
                  <span className={styles.fieldError}>{registerErrors.password.message}</span>
                )}
              </Field>
              <Field label="Confirm password" className={styles.fieldLast}>
                <input
                  type="password"
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  data-testid="confirm-password-input"
                  className={`${styles.input} ${registerErrors.confirmPassword ? styles.inputError : ""}`}
                  {...registerField("confirmPassword")}
                />
                {registerErrors.confirmPassword && (
                  <span className={styles.fieldError}>{registerErrors.confirmPassword.message}</span>
                )}
              </Field>
              {registerError && (
                <p className={styles.formError} role="alert" data-testid="register-error">
                  {registerError}
                </p>
              )}
              <PrimaryButton type="submit" disabled={isRegisterSubmitting}>Create account</PrimaryButton>
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

/* ── Sub-components ───────────────────────────────────────────────── */

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

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.13 17.64 11.82 17.64 9.2z" fill={googleBrand.blue} />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill={googleBrand.green} />
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill={googleBrand.yellow} />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill={googleBrand.red} />
    </svg>
  );
}
