"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { logger } from "@/lib/logger";
import styles from "./edit-vehicle.module.css";

interface VehicleFields {
  nickname: string;
  make: string;
  model: string;
  year: string;
  mileage: string;
}

type FieldErrors = Partial<Record<keyof VehicleFields, string>>;
type LoadState = "loading" | "ready" | "not-found" | "error";

const CURRENT_YEAR = new Date().getFullYear();

export default function EditVehiclePage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [fields, setFields] = useState<VehicleFields>({
    nickname: "",
    make: "",
    model: "",
    year: "",
    mileage: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !vehicleId) return;
    apiFetch<{ vehicle: { nickname: string | null; make: string; model: string; year: number; mileage: number } }>(
      `/vehicles/${vehicleId}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    )
      .then(({ vehicle }) => {
        setFields({
          nickname: vehicle.nickname ?? "",
          make: vehicle.make,
          model: vehicle.model,
          year: String(vehicle.year),
          mileage: String(vehicle.mileage),
        });
        setLoadState("ready");
      })
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setLoadState("not-found");
        } else {
          logger.error("failed to load vehicle for edit", { err });
          setLoadState("error");
        }
      });
  }, [session, vehicleId]);

  function updateField(field: keyof VehicleFields) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setFields((f) => ({ ...f, [field]: value }));
      setErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
    };
  }

  function validateFields(): FieldErrors {
    const next: FieldErrors = {};
    if (!fields.make.trim()) next.make = "Enter the manufacturer.";
    if (!fields.model.trim()) next.model = "Enter the model.";
    const year = Number(fields.year.trim());
    if (!/^\d+$/.test(fields.year.trim()) || year < 1900 || year > CURRENT_YEAR + 1) {
      next.year = `Enter a year between 1900 and ${CURRENT_YEAR + 1}.`;
    }
    const mileage = Number(fields.mileage.trim().replace(/,/g, ""));
    if (!/^[\d,]+$/.test(fields.mileage.trim()) || mileage < 0) {
      next.mileage = "Enter the current mileage.";
    }
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validateFields();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!session) {
      setSubmitError("You are not signed in. Please sign in and try again.");
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      await apiFetch(`/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({
          nickname: fields.nickname.trim() || null,
          make: fields.make.trim(),
          model: fields.model.trim(),
          year: Number(fields.year.trim()),
          mileage: Number(fields.mileage.trim().replace(/,/g, "")),
        }),
      });
      router.push(`/garage/${vehicleId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setSubmitError("Couldn’t save changes. Check the details and try again.");
      } else {
        logger.error("failed to update vehicle", { err });
        setSubmitError("We stalled. Our mechanics are on it — try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState === "not-found") return <NotFoundState />;
  if (loadState === "error") return <ErrorState />;

  return (
    <div className={styles.scene}>
      <header className={styles.topbar}>
        <Link href={`/garage/${vehicleId}`} className={styles.backLink}>
          <BackIcon />
          Back to vehicle
        </Link>
        <h1 className={styles.topbarTitle}>Edit vehicle</h1>
        <div className={styles.topbarSpacer} />
      </header>

      <div className={styles.page}>
        <div className={styles.formCard}>
          {loadState === "loading" ? (
            <div className={styles.loadingSkeleton} data-testid="loading-skeleton" />
          ) : (
            <form onSubmit={handleSubmit} noValidate data-testid="edit-vehicle-form">
              <Field label="Nickname" id="fNickname" optional>
                <input
                  id="fNickname"
                  type="text"
                  placeholder="e.g. The Daily"
                  autoComplete="off"
                  className={styles.fieldInput}
                  data-testid="nickname-input"
                  value={fields.nickname}
                  onChange={updateField("nickname")}
                />
              </Field>

              <div className={styles.fieldRow}>
                <Field label="Make" id="fMake" error={errors.make}>
                  <input
                    id="fMake"
                    type="text"
                    placeholder="Triumph"
                    autoComplete="off"
                    className={`${styles.fieldInput} ${errors.make ? styles.fieldInputError : ""}`}
                    data-testid="make-input"
                    value={fields.make}
                    onChange={updateField("make")}
                  />
                </Field>
                <Field label="Model" id="fModel" error={errors.model}>
                  <input
                    id="fModel"
                    type="text"
                    placeholder="Street Triple RS"
                    autoComplete="off"
                    className={`${styles.fieldInput} ${errors.model ? styles.fieldInputError : ""}`}
                    data-testid="model-input"
                    value={fields.model}
                    onChange={updateField("model")}
                  />
                </Field>
              </div>

              <div className={styles.fieldRow}>
                <Field label="Year" id="fYear" error={errors.year}>
                  <input
                    id="fYear"
                    type="text"
                    inputMode="numeric"
                    placeholder="2021"
                    autoComplete="off"
                    className={`${styles.fieldInput} ${errors.year ? styles.fieldInputError : ""}`}
                    data-testid="year-input"
                    value={fields.year}
                    onChange={updateField("year")}
                  />
                </Field>
                <Field label="Current mileage" id="fMileage" error={errors.mileage}>
                  <div className={styles.inputSuffixWrap}>
                    <input
                      id="fMileage"
                      type="text"
                      inputMode="numeric"
                      placeholder="14,230"
                      autoComplete="off"
                      className={`${styles.fieldInput} ${errors.mileage ? styles.fieldInputError : ""}`}
                      data-testid="mileage-input"
                      value={fields.mileage}
                      onChange={updateField("mileage")}
                    />
                    <span className={styles.inputSuffix}>mi</span>
                  </div>
                </Field>
              </div>

              {submitError && (
                <span className={styles.submitError} role="alert" data-testid="submit-error">
                  {submitError}
                </span>
              )}

              <div className={styles.formActions}>
                <Link href={`/garage/${vehicleId}`} className={styles.btnGhost} data-testid="cancel-btn">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  data-testid="save-btn"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function Field({
  label,
  id,
  optional,
  error,
  children,
}: {
  label: string;
  id: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
        {optional && <span className={styles.optional}> (optional)</span>}
      </label>
      {children}
      {error && (
        <span className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function NotFoundState() {
  return (
    <div className={styles.stateScene}>
      <p className={styles.stateMessage}>Vehicle not found.</p>
      <Link href="/garage" className={styles.stateLink}>Back to garage</Link>
    </div>
  );
}

function ErrorState() {
  return (
    <div className={styles.stateScene}>
      <p className={styles.stateMessage}>Something went wrong loading this vehicle.</p>
      <Link href="/garage" className={styles.stateLink}>Back to garage</Link>
    </div>
  );
}

/* ── Icons ──────────────────────────────────────────────────────── */

function BackIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M12.5 7.5H2.5M6.5 4.5l-3 3 3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
