import type { InsuranceInput } from "@maintenance-log/api-client";

// Pure core for the insurance dialog (ADR 0043).

export interface InsuranceDialogDraft {
  company: string;
  policyNumber: string;
  startDate: string;
  expiryDate: string;
  premium: string;
  premiumPeriod: string;
  towNumber: string;
  notes: string;
}

// Normalise the string draft into the API input: trim text (empty → null),
// dates pass through (empty → null), premium parses to a number (empty → null).
export function buildInsuranceInput(draft: InsuranceDialogDraft): InsuranceInput {
  return {
    company: draft.company.trim() || null,
    policyNumber: draft.policyNumber.trim() || null,
    startDate: draft.startDate || null,
    expiryDate: draft.expiryDate || null,
    premium: draft.premium ? parseFloat(draft.premium) : null,
    premiumPeriod: (draft.premiumPeriod as InsuranceInput["premiumPeriod"]) || null,
    towNumber: draft.towNumber.trim() || null,
    notes: draft.notes.trim() || null,
  };
}
