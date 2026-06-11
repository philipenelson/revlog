"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  ArrowIcon,
  BackArrowIcon,
  CameraIcon,
  Logo,
  VehicleGlyphIcon,
} from "@/application/components/icons";
import { Wordmark } from "@/application/components/Wordmark";
import { FormField } from "@/application/components/FormField";
import { useAddVehicleViewModel } from "./useAddVehicleViewModel";
import styles from "./add-vehicle.module.css";

export function AddVehicleScreen() {
  const vm = useAddVehicleViewModel();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.scene}>
      <header className={styles.topbar}>
        <div className={styles.topbarLogo}>
          <Logo />
          <Wordmark classes={styles} />
        </div>
        <Link href="/garage" className={styles.backLink}>
          <BackArrowIcon />
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
            <form onSubmit={vm.handleSubmit} noValidate>
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

              <div className={styles.photoField}>
                <label className={styles.fieldLabel}>
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
                        type="file"
                        accept="image/*"
                        className={styles.photoZoneInput}
                        onChange={vm.handlePhotoChange}
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

              {vm.submitError && (
                <span className={styles.submitError} role="alert" data-testid="submit-error">
                  {vm.submitError}
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
                  disabled={vm.submitting}
                >
                  {vm.submitting ? "Saving…" : "Add vehicle"}
                  {!vm.submitting && <ArrowIcon />}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className={styles.previewColumn}>
          <div className={styles.previewLabel}>Live preview</div>
          <div className={`${styles.previewCard} ${vm.isComplete ? styles.previewCardComplete : ""}`}>
            {vm.photoPreviewUrl ? (
              <div className={styles.previewPhotoStrip}>
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from FileReader; next/image does not support data: URIs */}
                <img src={vm.photoPreviewUrl} alt="" className={styles.previewPhotoImg} />
                <div className={styles.previewPhotoOverlay} />
              </div>
            ) : (
              <div className={styles.previewGlyph}>
                <VehicleGlyphIcon />
              </div>
            )}
            <div className={styles.previewName}>
              {vm.displayName ?? "Make Model"}
            </div>
            <div className={styles.previewMeta}>
              {vm.draft.make.trim() || "Make"}
              {" · "}
              {vm.draft.model.trim() || "Model"}
              {" · "}
              {vm.draft.year.trim() || "Year"}
            </div>
            <div className={styles.previewStats}>
              <div>
                {vm.draft.mileage.trim() ? (
                  <div className={styles.previewStatValue}>
                    {Number(vm.draft.mileage.trim().replace(/,/g, "")).toLocaleString()}
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
