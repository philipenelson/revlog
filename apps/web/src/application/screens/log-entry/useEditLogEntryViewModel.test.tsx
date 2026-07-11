import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@/test/renderViewModel";

const { push, getLogEntry, updateLogEntry, deleteLogEntry } = vi.hoisted(() => ({
  push: vi.fn(),
  getLogEntry: vi.fn(),
  updateLogEntry: vi.fn(),
  deleteLogEntry: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ vehicleId: "v1", entryId: "e1" }),
}));
vi.mock("@/adapters/media/useMediaStore", () => ({
  useMediaStore: () => ({ save: vi.fn(), getUrl: vi.fn(), delete: vi.fn(), listForEntry: vi.fn() }),
}));
vi.mock("@maintenance-log/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@maintenance-log/api-client")>()),
  getLogEntry: (...a: unknown[]) => getLogEntry(...a),
  updateLogEntry: (...a: unknown[]) => updateLogEntry(...a),
  deleteLogEntry: (...a: unknown[]) => deleteLogEntry(...a),
}));
vi.mock("@/adapters/http/CookieHttpClient", () => ({ cookieHttpClient: {} }));

import { useEditLogEntryViewModel } from "./useEditLogEntryViewModel";

const entry = {
  id: "e1",
  typeId: "SERVICE",
  title: "Oil change",
  date: "2026-06-01",
  time: null,
  mileage: 4200,
  notes: null,
  items: [],
  media: [],
};

beforeEach(() => vi.clearAllMocks());

describe("useEditLogEntryViewModel (hook shell)", () => {
  it("loads the entry into form state", async () => {
    getLogEntry.mockResolvedValue(entry);
    const { result } = renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.formState?.title).toBe("Oil change");
    expect(result.current.formState?.typeId).toBe("SERVICE");
  });

  it("surfaces a load failure message", async () => {
    getLogEntry.mockRejectedValue(new Error("gone"));
    const { result } = renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("gone");
  });

  it("saves changes and returns to the vehicle", async () => {
    getLogEntry.mockResolvedValue(entry);
    updateLogEntry.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(updateLogEntry).toHaveBeenCalledWith(expect.anything(), "v1", "e1", expect.anything());
    expect(push).toHaveBeenCalledWith("/garage/v1");
  });

  it("toggles the delete-confirm dialog", async () => {
    getLogEntry.mockResolvedValue(entry);
    const { result } = renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.openDeleteConfirm());
    expect(result.current.showDeleteConfirm).toBe(true);
    act(() => result.current.closeDeleteConfirm());
    expect(result.current.showDeleteConfirm).toBe(false);
  });

  it("deletes the entry and returns to the vehicle", async () => {
    getLogEntry.mockResolvedValue(entry);
    deleteLogEntry.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.handleDelete();
    });
    expect(deleteLogEntry).toHaveBeenCalledWith(expect.anything(), "v1", "e1");
    expect(push).toHaveBeenCalledWith("/garage/v1");
  });
});
