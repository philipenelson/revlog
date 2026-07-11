import { describe, it, expect, vi } from "vitest";
import type { InsuranceRecord } from "@maintenance-log/api-client";
import { renderHook, act } from "@/test/renderViewModel";
import { useInsuranceDialogViewModel } from "./useInsuranceDialogViewModel";

const render = (insurance: InsuranceRecord | null, editMode: boolean, onSave = vi.fn(), onClose = vi.fn()) => ({
  ...renderHook(() => useInsuranceDialogViewModel(insurance, editMode, onSave, onClose)),
  onSave,
  onClose,
});

describe("useInsuranceDialogViewModel (hook shell)", () => {
  it("seeds the draft from an existing record", () => {
    const { result } = render({ company: "Acme", premium: "45.50" } as InsuranceRecord, false);
    expect(result.current.draft.company).toBe("Acme");
    expect(result.current.editMode).toBe(false);
  });

  it("startEditing enters edit mode", () => {
    const { result } = render(null, false);
    act(() => result.current.startEditing());
    expect(result.current.editMode).toBe(true);
  });

  it("saves the normalised input then closes", async () => {
    const { result, onSave, onClose } = render(null, true);
    onSave.mockResolvedValue(undefined);
    act(() => result.current.setField("company", "  Acme  "));
    act(() => result.current.setField("premium", "45.50"));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ company: "Acme", premium: 45.5 }));
    expect(onClose).toHaveBeenCalled();
  });

  it("surfaces a save error and stays open", async () => {
    const { result, onClose } = render(null, true, vi.fn().mockRejectedValue(new Error("x")));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.saveError).toMatch(/Couldn't save insurance/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancel reverts to view mode when a record exists", () => {
    const { result, onClose } = render({ company: "Acme" } as InsuranceRecord, true);
    act(() => result.current.handleCancel());
    expect(result.current.editMode).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancel closes the dialog when there is no record yet", () => {
    const { result, onClose } = render(null, true);
    act(() => result.current.handleCancel());
    expect(onClose).toHaveBeenCalled();
  });
});
