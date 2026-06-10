"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/application/providers/AuthProvider";
import { ApiError } from "@/model/errors";
import { createVehicle, createVehicleWithPhoto } from "@/model/services/vehicleService";
import { validateVehicleDraft } from "@/model/validation/vehicleDraft";
import type { VehicleDraft, VehicleDraftErrors as FieldErrors } from "@/model/types";
import { logger } from "@/infrastructure/logging/logger";
import styles from "./add-vehicle.module.css";

const EMPTY_DRAFT: VehicleDraft = { nickname: "", make: "", model: "", year: "", mileage: "" };

export default function AddVehiclePage() {
  const router = useRouter();
  const { session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<VehicleDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateField(field: keyof VehicleDraft) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setDraft((d) => ({ ...d, [field]: value }));
      setErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
    };
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreviewUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function validateDraft(): FieldErrors {
    return validateVehicleDraft(draft, { enforceYearRange: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validateDraft();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!session) {
      setSubmitError("You are not signed in. Please sign in and try again.");
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      const payload = {
        nickname: draft.nickname.trim() || undefined,
        make: draft.make.trim(),
        model: draft.model.trim(),
        year: Number(draft.year.trim()),
        mileage: Number(draft.mileage.trim().replace(/,/g, "")),
      };
      if (photoFile) {
        await createVehicleWithPhoto(session.accessToken, payload, photoFile);
      } else {
        await createVehicle(session.accessToken, payload);
      }
      router.push("/garage");
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setSubmitError("Couldn't save your vehicle. Check the details and try again.");
      } else {
        logger.error("failed to add vehicle", { err });
        setSubmitError("We stalled. Our mechanics are on it — try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const displayName = draft.nickname.trim() || (draft.make.trim() && draft.model.trim()
    ? `${draft.make.trim()} ${draft.model.trim()}`
    : null
  );
  const isComplete = Boolean(draft.make.trim() && draft.model.trim() && draft.year.trim() && draft.mileage.trim());

  return (
    <div className={styles.scene}>
      <header className={styles.topbar}>
        <div className={styles.topbarLogo}>
          <Logo />
          <div className={styles.wordmark}>
            <span className={styles.wordmarkLight}>Rev</span>
            <span className={styles.wordmarkBold}>log</span>
          </div>
        </div>
        <Link href="/garage" className={styles.backLink}>
          <BackIcon />
          Back to garage
        </Link>
      </header>

      <div className={styles.page}>
        <div className={styles.formColumn}>
          <div className={styles.eyebrow}>Garage</div>
          <h1 className={styles.pageTitle}>Add a vehicle</h1>
          <p className={styles.pageSub}>
            Just the basics for now — you can fill in the rest from its detail page anytime.
          </p>

          <div className={styles.formCard}>
            <form onSubmit={handleSubmit} noValidate>
              <Field label="Nickname" id="fNickname" optional>
                <input
                  id="fNickname"
                  type="text"
                  placeholder="e.g. The Daily"
                  autoComplete="off"
                  className={styles.fieldInput}
                  data-testid="nickname-input"
                  value={draft.nickname}
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
                    value={draft.make}
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
                    value={draft.model}
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
                    value={draft.year}
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
                      value={draft.mileage}
                      onChange={updateField("mileage")}
                    />
                    <span className={styles.inputSuffix}>mi</span>
                  </div>
                </Field>
              </div>

              <div className={styles.photoField}>
                <label className={styles.fieldLabel}>
                  Photo
                  <span className={styles.optional}> (optional)</span>
                </label>
                <div className={styles.photoZone} data-testid="photo-zone">
                  {photoPreviewUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from FileReader; next/image does not support data: URIs */}
                      <img
                        src={photoPreviewUrl}
                        alt="Vehicle preview"
                        className={styles.photoPreview}
                      />
                      <button
                        type="button"
                        className={styles.photoRemoveBtn}
                        onClick={removePhoto}
                        aria-label="Remove photo"
                        data-testid="remove-photo-btn"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className={styles.photoZoneInput}
                        onChange={handlePhotoChange}
                        data-testid="photo-input"
                        aria-label="Upload vehicle photo"
                      />
                      <CameraIcon className={styles.photoZoneIcon} />
                      <span className={styles.photoZoneLabel}>Click to upload a photo</span>
                      <span className={styles.photoZoneSub}>JPG, PNG, WebP — max 5 MB</span>
                    </>
                  )}
                </div>
              </div>

              {submitError && (
                <span className={styles.submitError} role="alert" data-testid="submit-error">
                  {submitError}
                </span>
              )}

              <div className={styles.formActions}>
                <Link href="/garage" className={styles.btnGhost}>
                  Cancel
                </Link>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  data-testid="add-vehicle-btn"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Add vehicle"}
                  {!submitting && <ArrowIcon />}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className={styles.previewColumn}>
          <div className={styles.previewLabel}>Live preview</div>
          <div className={`${styles.previewCard} ${isComplete ? styles.previewCardComplete : ""}`}>
            {photoPreviewUrl ? (
              <div className={styles.previewPhotoStrip}>
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from FileReader; next/image does not support data: URIs */}
                <img src={photoPreviewUrl} alt="" className={styles.previewPhotoImg} />
                <div className={styles.previewPhotoOverlay} />
              </div>
            ) : (
              <div className={styles.previewGlyph}>
                <VehicleGlyphIcon />
              </div>
            )}
            <div className={styles.previewName}>
              {displayName ?? "Make Model"}
            </div>
            <div className={styles.previewMeta}>
              {draft.make.trim() || "Make"}
              {" · "}
              {draft.model.trim() || "Model"}
              {" · "}
              {draft.year.trim() || "Year"}
            </div>
            <div className={styles.previewStats}>
              <div>
                {draft.mileage.trim() ? (
                  <div className={styles.previewStatValue}>
                    {Number(draft.mileage.trim().replace(/,/g, "")).toLocaleString()}
                    <span className={styles.previewUnit}>mi</span>
                  </div>
                ) : (
                  <div className={styles.previewStatValueDim}>—</div>
                )}
                <div className={styles.previewStatLabel}>Odometer</div>
              </div>
              <div>
                <div className={styles.previewStatValueDim}>No entries yet</div>
                <div className={styles.previewStatLabel}>Log entries</div>
              </div>
            </div>
            <div className={styles.previewLink}>
              View service history
              <ArrowIcon />
            </div>
          </div>
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

/* ── Icons ──────────────────────────────────────────────────────── */

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M 11 30 A 14 14 0 1 1 25 30" stroke="var(--surface-subtle)" strokeWidth="3" strokeLinecap="round" />
      <path d="M 11 30 A 14 14 0 1 1 30.1 11" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <line x1="18" y1="18" x2="27.5" y2="13" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="18" r="2.2" fill="var(--accent)" />
      <circle cx="30.1" cy="11" r="1.5" fill="var(--danger)" opacity="0.8" />
    </svg>
  );
}

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

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M2.5 7.5h10M8.5 4.5l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2.5 9.5C2.5 8.4 3.4 7.5 4.5 7.5h2.2l1.6-2.4a1 1 0 0 1 .83-.44h5.74a1 1 0 0 1 .83.44L17.3 7.5h2.2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2v-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function VehicleGlyphIcon() {
  return (
    <svg viewBox="0 0 80 48" fill="none" aria-hidden="true">
      <circle cx="16" cy="36" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="62" cy="36" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M16 36 L30 19 L46 19 L62 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 19 L37 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 19 L41 11 L52 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 13 L33 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
