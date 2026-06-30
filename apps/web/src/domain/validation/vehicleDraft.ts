import type { VehicleDraft, VehicleDraftErrors } from "@/domain/types";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Validates the shared vehicle form draft.
 *
 * `enforceYearRange` matches the intentional difference between flows:
 * the add/edit screens reject years outside 1900..(current+1), while
 * onboarding only requires a numeric year.
 */
export function validateVehicleDraft(
  draft: VehicleDraft,
  opts: { enforceYearRange: boolean },
): VehicleDraftErrors {
  const next: VehicleDraftErrors = {};
  if (!draft.make.trim()) next.make = "Enter the manufacturer.";
  if (!draft.model.trim()) next.model = "Enter the model.";

  const yearText = draft.year.trim();
  if (opts.enforceYearRange) {
    const year = Number(yearText);
    if (!/^\d+$/.test(yearText) || year < 1900 || year > CURRENT_YEAR + 1) {
      next.year = `Enter a year between 1900 and ${CURRENT_YEAR + 1}.`;
    }
  } else if (!/^\d+$/.test(yearText)) {
    next.year = "Enter a numeric year.";
  }

  const mileageText = draft.mileage.trim();
  if (opts.enforceYearRange) {
    const mileage = Number(mileageText.replace(/,/g, ""));
    if (!/^[\d,]+$/.test(mileageText) || mileage < 0) {
      next.mileage = "Enter the current mileage.";
    }
  } else if (!/^[\d,]+$/.test(mileageText)) {
    next.mileage = "Enter the current mileage.";
  }

  return next;
}
