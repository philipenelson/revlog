import { describe, it, expect } from "vitest";
import { buildInsuranceInput, type InsuranceDialogDraft } from "./insuranceDialog.logic";

const empty: InsuranceDialogDraft = {
  company: "",
  policyNumber: "",
  startDate: "",
  expiryDate: "",
  premium: "",
  premiumPeriod: "",
  towNumber: "",
  notes: "",
};

describe("insuranceDialog.logic — buildInsuranceInput", () => {
  it("maps a blank draft to all nulls", () => {
    expect(buildInsuranceInput(empty)).toEqual({
      company: null,
      policyNumber: null,
      startDate: null,
      expiryDate: null,
      premium: null,
      premiumPeriod: null,
      towNumber: null,
      notes: null,
    });
  });

  it("trims text, parses premium, passes dates and period through", () => {
    expect(
      buildInsuranceInput({
        ...empty,
        company: "  Acme  ",
        premium: "45.50",
        premiumPeriod: "MONTHLY",
        startDate: "2026-01-01",
        notes: "  keep  ",
      }),
    ).toMatchObject({ company: "Acme", premium: 45.5, premiumPeriod: "MONTHLY", startDate: "2026-01-01", notes: "keep" });
  });
});
