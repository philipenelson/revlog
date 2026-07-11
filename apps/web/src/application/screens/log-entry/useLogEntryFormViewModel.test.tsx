import { describe, it, expect, vi } from "vitest";
import type { ChangeEvent } from "react";
import { renderHook, act } from "@/test/renderViewModel";
import { emptyLogEntryFormState } from "@/domain/logEntryDraft";
import { useLogEntryFormViewModel } from "./useLogEntryFormViewModel";

const fileEvent = (files: File[]) => ({ target: { files } }) as unknown as ChangeEvent<HTMLInputElement>;
const img = (name: string, size: number) => ({ name, type: "image/jpeg", size }) as File;

describe("useLogEntryFormViewModel (hook shell)", () => {
  it("canSave reflects type + title + not-saving", () => {
    const base = { ...emptyLogEntryFormState(), typeId: "SERVICE", title: "Oil" };
    expect(renderHook(() => useLogEntryFormViewModel(base, vi.fn(), false)).result.current.canSave).toBe(true);
    expect(renderHook(() => useLogEntryFormViewModel({ ...base, title: "" }, vi.fn(), false)).result.current.canSave).toBe(false);
    expect(renderHook(() => useLogEntryFormViewModel(base, vi.fn(), true)).result.current.canSave).toBe(false);
  });

  it("setField emits the patched state via onChange", () => {
    const onChange = vi.fn();
    const state = emptyLogEntryFormState();
    const { result } = renderHook(() => useLogEntryFormViewModel(state, onChange, false));
    act(() => result.current.setField("title", "Brakes"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: "Brakes" }));
  });

  it("addItem appends a PART item", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useLogEntryFormViewModel(emptyLogEntryFormState(), onChange, false));
    act(() => result.current.addItem());
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ items: [expect.objectContaining({ categoryId: "PART", description: "" })] }),
    );
  });

  it("removeItem drops the item", () => {
    const onChange = vi.fn();
    const state = {
      ...emptyLogEntryFormState(),
      items: [{ id: "i1", categoryId: "PART", description: "x", quantity: "", unitCost: "" }],
    };
    const { result } = renderHook(() => useLogEntryFormViewModel(state, onChange, false));
    act(() => result.current.removeItem("i1"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ items: [] }));
  });

  it("rejects the whole batch and sets mediaError when over the file cap", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useLogEntryFormViewModel(emptyLogEntryFormState(), onChange, false));
    const many = Array.from({ length: 11 }, (_, i) => img(`f${i}.jpg`, 1));
    act(() => result.current.handleFileChange(fileEvent(many), null));
    expect(result.current.mediaError).toBe("Maximum 10 files allowed");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts a valid file and appends a media draft", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useLogEntryFormViewModel(emptyLogEntryFormState(), onChange, false));
    act(() => result.current.handleFileChange(fileEvent([img("ok.jpg", 1000)]), null));
    expect(result.current.mediaError).toBeNull();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mediaDrafts: [expect.objectContaining({ caption: "", url: "blob:mock" })] }),
    );
  });
});
