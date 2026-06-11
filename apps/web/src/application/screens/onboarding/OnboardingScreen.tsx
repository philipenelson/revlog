"use client";

import { useRef } from "react";
import { ArrowIcon, CameraIcon, Logo } from "@/application/components/icons";
import { Wordmark } from "@/application/components/Wordmark";
import { FormField } from "@/application/components/FormField";
import { StatusOrb } from "@/application/components/StatusOrb";
import { useOnboardingViewModel, type OnboardingStep } from "./useOnboardingViewModel";
import styles from "./onboarding.module.css";

const STEP_LABELS = ["Welcome", "Your vehicle", "Ready"] as const;

export function OnboardingScreen() {
  const vm = useOnboardingViewModel();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.scene}>
      <div className={styles.card}>
        <div className={styles.cardLogo}>
          <Logo size={30} />
          <Wordmark classes={styles} />
        </div>

        <StepIndicator step={vm.step} />

        {vm.step === 1 && (
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
              onClick={vm.goToVehicleStep}
            >
              Add my first vehicle
              <ArrowIcon size={15} />
            </button>
            {vm.skipError && (
              <p className={styles.fieldError} role="alert" data-testid="skip-error">
                {vm.skipError}
              </p>
            )}
            <button
              type="button"
              className={styles.textLink}
              data-testid="skip-onboarding-btn"
              onClick={vm.handleSkip}
              disabled={vm.skipping}
            >
              {vm.skipping ? "Skipping…" : "Skip for now"}
            </button>
          </section>
        )}

        {vm.step === 2 && (
          <section className={styles.wizardStep} data-testid="step-vehicle">
            <div className={styles.eyebrow}>Step 2 of 3 — Your vehicle</div>
            <h1 className={styles.headline}>Tell us about your bike</h1>
            <p className={styles.bodyCopy}>
              Just the basics for now — you can fill in the rest from its detail
              page anytime.
            </p>

            <form className={styles.formFields} onSubmit={vm.handleContinue} noValidate>
              <FormField label="Nickname" id="fNickname" optional classes={styles}>
                <input
                  id="fNickname"
                  type="text"
                  placeholder="e.g. The Daily"
                  autoComplete="off"
                  className={styles.fieldInput}
                  data-testid="nickname-input"
                  value={vm.draft.nickname}
                  onChange={vm.updateField("nickname")}
                />
              </FormField>

              <div className={styles.fieldRow}>
                <FormField label="Make" id="fMake" error={vm.errors.make} classes={styles}>
                  <input
                    id="fMake"
                    type="text"
                    placeholder="Triumph"
                    autoComplete="off"
                    className={`${styles.fieldInput} ${vm.errors.make ? styles.fieldInputError : ""}`}
                    data-testid="make-input"
                    value={vm.draft.make}
                    onChange={vm.updateField("make")}
                  />
                </FormField>
                <FormField label="Model" id="fModel" error={vm.errors.model} classes={styles}>
                  <input
                    id="fModel"
                    type="text"
                    placeholder="Street Triple RS"
                    autoComplete="off"
                    className={`${styles.fieldInput} ${vm.errors.model ? styles.fieldInputError : ""}`}
                    data-testid="model-input"
                    value={vm.draft.model}
                    onChange={vm.updateField("model")}
                  />
                </FormField>
              </div>

              <div className={styles.fieldRow}>
                <FormField label="Year" id="fYear" error={vm.errors.year} classes={styles}>
                  <input
                    id="fYear"
                    type="text"
                    inputMode="numeric"
                    placeholder="2021"
                    autoComplete="off"
                    className={`${styles.fieldInput} ${vm.errors.year ? styles.fieldInputError : ""}`}
                    data-testid="year-input"
                    value={vm.draft.year}
                    onChange={vm.updateField("year")}
                  />
                </FormField>
                <FormField label="Current mileage" id="fMileage" error={vm.errors.mileage} classes={styles}>
                  <div className={styles.inputSuffixWrap}>
                    <input
                      id="fMileage"
                      type="text"
                      inputMode="numeric"
                      placeholder="14,230"
                      autoComplete="off"
                      className={`${styles.fieldInput} ${vm.errors.mileage ? styles.fieldInputError : ""}`}
                      data-testid="mileage-input"
                      value={vm.draft.mileage}
                      onChange={vm.updateField("mileage")}
                    />
                    <span className={styles.inputSuffix}>mi</span>
                  </div>
                </FormField>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="fPhoto">
                  Photo
                  <span className={styles.optional}> (optional)</span>
                </label>
                <div className={styles.photoZone} data-testid="photo-zone">
                  {vm.photoPreviewUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from FileReader; next/image does not support data: URIs */}
                      <img
                        src={vm.photoPreviewUrl}
                        alt="Vehicle preview"
                        className={styles.photoPreview}
                      />
                      <button
                        type="button"
                        className={styles.photoRemoveBtn}
                        onClick={() => vm.removePhoto(fileInputRef.current)}
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
                        onChange={vm.handlePhotoChange}
                        data-testid="photo-input"
                        aria-label="Upload vehicle photo"
                      />
                      <CameraIcon size={24} />
                      <span className={styles.photoZoneLabel}>Click to add a photo</span>
                      <span className={styles.photoZoneSub}>JPG, PNG, WebP — max 5 MB</span>
                    </>
                  )}
                </div>
              </div>

              {vm.vehicleError && (
                <p className={styles.fieldError} role="alert" data-testid="vehicle-save-error">
                  {vm.vehicleError}
                </p>
              )}

              <div className={styles.wizardActions}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  data-testid="back-btn"
                  onClick={vm.goBackToWelcome}
                  disabled={vm.submitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  data-testid="continue-btn"
                  disabled={vm.submitting}
                >
                  {vm.submitting ? "Saving…" : "Continue"}
                  <ArrowIcon size={15} />
                </button>
              </div>
            </form>
          </section>
        )}

        {vm.step === 3 && vm.vehicle && (
          <section className={styles.wizardStep} data-testid="step-ready">
            <StatusOrb state="verified" />
            <div className={`${styles.eyebrow} ${styles.eyebrowSuccess}`}>All set</div>
            <h1 className={styles.headline} data-testid="ready-headline">
              {vm.readyHeadline}
            </h1>
            <p className={styles.bodyCopy}>
              You&apos;re ready to start logging its service history — every oil
              change, tyre swap, and repair, all in one place.
            </p>

            <div className={styles.vehiclePlate} data-testid="vehicle-plate">
              <div className={styles.plateRow}>
                <span>Nickname</span>
                <strong>{vm.vehicle.nickname.trim() || "—"}</strong>
              </div>
              <div className={styles.plateRow}>
                <span>Make &amp; model</span>
                <strong>{`${vm.vehicle.make.trim()} ${vm.vehicle.model.trim()}`.trim()}</strong>
              </div>
              <div className={styles.plateRow}>
                <span>Year</span>
                <strong>{vm.vehicle.year.trim()}</strong>
              </div>
              <div className={styles.plateRow}>
                <span>Mileage</span>
                <strong className={styles.mono}>{`${vm.vehicle.mileage.trim()} mi`}</strong>
              </div>
            </div>

            <button
              type="button"
              className={styles.btnPrimary}
              data-testid="go-to-garage-btn"
              onClick={vm.goToGarage}
            >
              Go to my garage
              <ArrowIcon size={15} />
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

/* ── Presentational sub-components ──────────────────────────────── */

function StepIndicator({ step }: { step: OnboardingStep }) {
  return (
    <div data-testid="step-indicator" data-active-step={step}>
      <div className={styles.stepTrack}>
        {([1, 2, 3] as OnboardingStep[]).map((n) => (
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
          const n = (i + 1) as OnboardingStep;
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
