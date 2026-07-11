"use client";

import { useState } from "react";
import type { InsuranceInput, InsuranceRecord } from "@maintenance-log/api-client";

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

export interface InsuranceDialogViewModel {
  editMode: boolean;
  startEditing: () => void;
  draft: InsuranceDialogDraft;
  setField: (field: keyof InsuranceDialogDraft, value: string) => void;
  isSaving: boolean;
  saveError: string | null;
  handleSave: () => Promise<void>;
  handleCancel: () => void;
}

export function useInsuranceDialogViewModel(
  insurance: InsuranceRecord | null,
  initialEditMode: boolean,
  onSave: (input: InsuranceInput) => Promise<void>,
  onClose: () => void,
): InsuranceDialogViewModel {
  const [editMode, setEditMode] = useState(initialEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [draft, setDraft] = useState<InsuranceDialogDraft>({
    company: insurance?.company ?? "",
    policyNumber: insurance?.policyNumber ?? "",
    startDate: insurance?.startDate ?? "",
    expiryDate: insurance?.expiryDate ?? "",
    premium: insurance?.premium ?? "",
    premiumPeriod: insurance?.premiumPeriod ?? "",
    towNumber: insurance?.towNumber ?? "",
    notes: insurance?.notes ?? "",
  });

  function setField(field: keyof InsuranceDialogDraft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);
    try {
      await onSave(buildInsuranceInput(draft));
      onClose();
    } catch {
      setSaveError("Couldn't save insurance details. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (insurance) {
      setEditMode(false);
    } else {
      onClose();
    }
  }

  return {
    editMode,
    startEditing: () => setEditMode(true),
    draft,
    setField,
    isSaving,
    saveError,
    handleSave,
    handleCancel,
  };
}
