"use client";

import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { StatusOrb } from "@/components/StatusOrb";
import { useAuth } from "@/application/providers/AuthProvider";
import { ApiError } from "@/model/errors";
import { createVehicle, createVehicleWithPhoto } from "@/model/services/vehicleService";
import { skipOnboarding } from "@/model/services/onboardingService";
import { validateVehicleDraft } from "@/model/validation/vehicleDraft";
import { logger } from "@/infrastructure/logging/logger";
import styles from "./onboarding.module.css";

type Step = 1 | 2 | 3;

const STEP_LABELS = ["Welcome", "Your vehicle", "Ready"] as const;

interface VehicleDraft {
  nickname: string;
  make: string;
  model: string;
  year: string;
  mileage: string;
}

const EMPTY_DRAFT: VehicleDraft = { nickname: "", make: "", model: "", year: "", mileage: "" };

type FieldErrors = Partial<Record<keyof VehicleDraft, string>>;

const VEHICLE_SAVE_ERROR = "Couldn't save your vehicle. Check the details and try again.";
const SKIP_ERROR = "Couldn't skip onboarding right now. Try again in a moment.";
const SERVICE_ERROR = "We stalled. Our mechanics are on it — try again in a moment.";

export default function OnboardingPage() {
  const router = useRouter();
  const { session, setSession } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<VehicleDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<VehicleDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);

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
    reader.onload = (ev) => setPhotoPreviewUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function validateDraft(): FieldErrors {
    return validateVehicleDraft(draft, { enforceYearRange: false });
  }

  function activateAccount() {
    if (session) setSession({ ...session, account: { ...session.account, status: "ACTIVE" } });
  }

  async function handleContinue(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validateDraft();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!session) {
      setVehicleError(SERVICE_ERROR);
      return;
    }

    setVehicleError(null);
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
      activateAccount();
      setVehicle({ ...draft });
      setStep(3);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setVehicleError(VEHICLE_SAVE_ERROR);
      } else {
        logger.error("vehicle creation failed during onboarding", { err });
        setVehicleError(SERVICE_ERROR);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    if (!session) {
      setSkipError(SERVICE_ERROR);
      return;
    }

    setSkipError(null);
    setSkipping(true);
    try {
      await skipOnboarding(session.accessToken);
      activateAccount();
      router.push("/garage");
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setSkipError(SKIP_ERROR);
      } else {
        logger.error("skip onboarding failed", { err });
        setSkipError(SERVICE_ERROR);
      }
    } finally {
      setSkipping(false);
    }
  }

  function goToGarage() {
    router.push("/garage");
  }

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

        <StepIndicator step={step} />

        {step === 1 && (
          <section className={styles.wizardStep} data-testid="step-welcome">
            <div className={styles.eyebrow}>Welcome to Revlog</div>
            <h1 className={styles.headline}>Let&apos;s set up your garage</h1>
            <p className={styles.bodyCopy}>
              Add the vehicle you ride most — you can always add more later. It
              takes less than a minute, and it&apos;s the start of a service
              history that&apos;s truly yours.
            </p>
            <button
              type="button"
              className={styles.btnPrimary}
              data-testid="add-first-vehicle-btn"
              onClick={() => setStep(2)}
            >
              Add my first vehicle
              <ArrowIcon />
            </button>
            {skipError && (
              <p className={styles.fieldError} role="alert" data-testid="skip-error">
                {skipError}
              </p>
            )}
            <button
              type="button"
              className={styles.textLink}
              data-testid="skip-onboarding-btn"
              onClick={handleSkip}
              disabled={skipping}
            >
              {skipping ? "Skipping…" : "Skip for now"}
            </button>
          </section>
        )}

        {step === 2 && (
          <section className={styles.wizardStep} data-testid="step-vehicle">
            <div className={styles.eyebrow}>Step 2 of 3 — Your vehicle</div>
            <h1 className={styles.headline}>Tell us about your bike</h1>
            <p className={styles.bodyCopy}>
              Just the basics for now — you can fill in the rest from its detail
              page anytime.
            </p>

            <form className={styles.formFields} onSubmit={handleContinue} noValidate>
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

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="fPhoto">
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
                        id="fPhoto"
                        type="file"
                        accept="image/*"
                        className={styles.photoZoneInput}
                        onChange={handlePhotoChange}
                        data-testid="photo-input"
                        aria-label="Upload vehicle photo"
                      />
                      <CameraIcon />
                      <span className={styles.photoZoneLabel}>Click to add a photo</span>
                      <span className={styles.photoZoneSub}>JPG, PNG, WebP — max 5 MB</span>
                    </>
                  )}
                </div>
              </div>

              {vehicleError && (
                <p className={styles.fieldError} role="alert" data-testid="vehicle-save-error">
                  {vehicleError}
                </p>
              )}

              <div className={styles.wizardActions}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  data-testid="back-btn"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  data-testid="continue-btn"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Continue"}
                  <ArrowIcon />
                </button>
              </div>
            </form>
          </section>
        )}

        {step === 3 && vehicle && (
          <section className={styles.wizardStep} data-testid="step-ready">
            <StatusOrb state="verified" />
            <div className={`${styles.eyebrow} ${styles.eyebrowSuccess}`}>All set</div>
            <h1 className={styles.headline} data-testid="ready-headline">
              {readyHeadline(vehicle)}
            </h1>
            <p className={styles.bodyCopy}>
              You&apos;re ready to start logging its service history — every oil
              change, tyre swap, and repair, all in one place.
            </p>

            <div className={styles.vehiclePlate} data-testid="vehicle-plate">
              <div className={styles.plateRow}>
                <span>Nickname</span>
                <strong>{vehicle.nickname.trim() || "—"}</strong>
              </div>
              <div className={styles.plateRow}>
                <span>Make &amp; model</span>
                <strong>{`${vehicle.make.trim()} ${vehicle.model.trim()}`.trim()}</strong>
              </div>
              <div className={styles.plateRow}>
                <span>Year</span>
                <strong>{vehicle.year.trim()}</strong>
              </div>
              <div className={styles.plateRow}>
                <span>Mileage</span>
                <strong className={styles.mono}>{`${vehicle.mileage.trim()} mi`}</strong>
              </div>
            </div>

            <button
              type="button"
              className={styles.btnPrimary}
              data-testid="go-to-garage-btn"
              onClick={goToGarage}
            >
              Go to my garage
              <ArrowIcon />
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function readyHeadline(vehicle: VehicleDraft): string {
  const displayName = vehicle.nickname.trim() || `${vehicle.make.trim()} ${vehicle.model.trim()}`.trim();
  return `${displayName} is in your garage`;
}

/* ── Sub-components ─────────────────────────────────────────────── */

function StepIndicator({ step }: { step: Step }) {
  return (
    <div data-testid="step-indicator" data-active-step={step}>
      <div className={styles.stepTrack}>
        {([1, 2, 3] as Step[]).map((n) => (
          <div
            key={n}
            className={`${styles.stepTick} ${
              n < step ? styles.stepTickDone : n === step ? styles.stepTickActive : ""
            }`}
          />
        ))}
      </div>
      <div className={styles.stepLabels}>
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step;
          return (
            <span
              key={label}
              className={n === step ? styles.stepLabelActive : n < step ? styles.stepLabelDone : ""}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

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

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
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

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
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
