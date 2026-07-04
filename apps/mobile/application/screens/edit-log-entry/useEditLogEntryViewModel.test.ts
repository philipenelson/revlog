import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import type { LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import type { LogEntryFullDetail } from '@/domain/repositories/LogEntryRepository';
import { useEditLogEntryViewModel } from './useEditLogEntryViewModel';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ vehicleId: 'v1', entryId: 'e1' })),
}));
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));

import { useDatabase } from '@/application/providers/DatabaseProvider';

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
const mockBack = router.back as jest.Mock;

const vehicle: LocalVehicleDetail = {
  id: 'v1',
  nickname: 'Blackbird',
  make: 'Honda',
  model: 'CB650R',
  year: 2019,
  mileage: 4200,
  photoUrl: null,
  logEntryCount: 1,
  totalSpent: null,
  lastLoggedAt: null,
  transferPending: false,
  pendingTransferRecipientEmail: null,
};

const entry: LogEntryFullDetail = {
  id: 'e1',
  typeId: 'MAINTENANCE',
  title: 'Oil & filter change',
  date: '2026-06-28',
  time: null,
  mileage: 12400,
  notes: 'Full synthetic 10W-40',
  items: [{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99 }],
};

function setDatabase(
  foundEntry: LogEntryFullDetail | null,
  updateImpl?: () => Promise<void>,
  deleteImpl?: () => Promise<void>,
) {
  const update = jest.fn(updateImpl ?? (async () => {}));
  const del = jest.fn(deleteImpl ?? (async () => {}));
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: { findById: jest.fn(async () => vehicle) } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: { findById: jest.fn(async () => foundEntry), update, delete: del } as any,
  });
  return { update, delete: del };
}

describe('useEditLogEntryViewModel', () => {
  afterEach(() => jest.clearAllMocks());

  it('pre-fills fields and items from the local entry once loaded', async () => {
    setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());

    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.fields).toEqual({
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-06-28',
      mileage: '12400',
      notes: 'Full synthetic 10W-40',
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      categoryId: 'PART',
      description: 'Oil filter',
      quantity: '1',
      unitCost: '8.99',
    });
  });

  it('loads the vehicle display name for the header back-link', async () => {
    setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());

    await waitFor(() => expect(result.current.vehicleName).toBe('Blackbird'));
  });

  it('shows not-found when the entry does not exist locally', async () => {
    setDatabase(null);

    const { result } = await renderHook(() => useEditLogEntryViewModel());

    await waitFor(() => expect(result.current.loadState).toBe('not-found'));
  });

  it('blocks submission and surfaces field errors when a required field is cleared', async () => {
    setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.updateField('title', '');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(result.current.errors.title).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as that field is edited', async () => {
    setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.updateField('title', '');
    });
    await act(async () => {
      result.current.submit();
    });
    expect(result.current.errors.title).toBeTruthy();

    await act(async () => {
      result.current.updateField('title', 'Oil change');
    });

    expect(result.current.errors.title).toBeUndefined();
  });

  it('saves via logEntryRepository.update and navigates back on success', async () => {
    const { update } = setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.updateField('mileage', '12500');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(update).toHaveBeenCalledWith('v1', 'e1', {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-06-28',
      mileage: 12500,
      notes: 'Full synthetic 10W-40',
      items: [{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99 }],
    });
    // back(), not push() -- Edit was reached by pushing from Vehicle Detail
    // (tapping the entry's card), so pushing the same route again would
    // stack a second instance instead of returning to the one already there.
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('strips commas from mileage before validating and saving', async () => {
    const { update } = setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.updateField('mileage', '12,500');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(update).toHaveBeenCalledWith('v1', 'e1', expect.objectContaining({ mileage: 12500 }));
  });

  it('leaves notes null when cleared, and trims when provided', async () => {
    const { update } = setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.updateField('notes', '   ');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(update).toHaveBeenCalledWith('v1', 'e1', expect.objectContaining({ notes: null }));
  });

  it('adds, edits, and removes items, computing row and grand totals', async () => {
    setDatabase({ ...entry, items: [] });

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.addItem();
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.itemsTotal).toBeNull();

    const itemId = result.current.items[0]!.id;
    await act(async () => {
      result.current.updateItem(itemId, { description: 'Oil filter', quantity: '2', unitCost: '8.50' });
    });

    expect(result.current.itemRowTotal(result.current.items[0]!)).toBe('17.00');
    expect(result.current.itemsTotal).toBe('17.00');

    await act(async () => {
      result.current.removeItem(itemId);
    });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.itemsTotal).toBeNull();
  });

  it('sends priced items and drops rows left with a blank description', async () => {
    const { update } = setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.addItem();
    });
    const blank = result.current.items[1]!;
    await act(async () => {
      result.current.updateItem(blank.id, { description: '   ' });
    });
    await act(async () => {
      result.current.submit();
    });

    expect(update).toHaveBeenCalledWith(
      'v1',
      'e1',
      expect.objectContaining({
        items: [{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99 }],
      }),
    );
  });

  it('shows a submit error and does not navigate when the local write throws', async () => {
    setDatabase(entry, async () => {
      throw new Error('disk full');
    });

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.submitError).toBe("Couldn't save changes. Try again in a moment.");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('onDateSelected updates the date field and keeps the picker open only on iOS', async () => {
    setDatabase(entry);
    Platform.OS = 'android';

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    await act(async () => {
      result.current.openDatePicker();
    });
    expect(result.current.isDatePickerOpen).toBe(true);

    await act(async () => {
      result.current.onDateSelected(new Date(2026, 5, 15));
    });

    expect(result.current.fields.date).toBe('2026-06-15');
    expect(result.current.isDatePickerOpen).toBe(false);
  });

  it('onDatePickerDismiss closes the picker', async () => {
    setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    await act(async () => {
      result.current.openDatePicker();
    });

    await act(async () => {
      result.current.onDatePickerDismiss();
    });

    expect(result.current.isDatePickerOpen).toBe(false);
  });

  it('onCancel navigates back', async () => {
    setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    result.current.onCancel();

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('openDeleteDialog/closeDeleteDialog toggle deleteDialogOpen and clear any prior error', async () => {
    setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.openDeleteDialog();
    });
    expect(result.current.deleteDialogOpen).toBe(true);

    await act(async () => {
      result.current.closeDeleteDialog();
    });
    expect(result.current.deleteDialogOpen).toBe(false);
  });

  it('deletes via logEntryRepository.delete and navigates back to Vehicle Detail on success', async () => {
    const { delete: del } = setDatabase(entry);

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.openDeleteDialog();
    });
    await act(async () => {
      result.current.handleDelete();
    });

    expect(del).toHaveBeenCalledWith('v1', 'e1');
    // back(), not dismissTo() -- unlike deleting a Vehicle, this only
    // removes one entry from a Vehicle Detail screen that's still valid to
    // show underneath.
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows a delete error and keeps the dialog open when the local delete throws', async () => {
    setDatabase(entry, undefined, async () => {
      throw new Error('disk full');
    });

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.openDeleteDialog();
    });
    await act(async () => {
      result.current.handleDelete();
    });

    expect(result.current.deleteError).toBe("Couldn't delete this log entry. Try again in a moment.");
    expect(result.current.deleteDialogOpen).toBe(true);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('closeDeleteDialog is a no-op while a delete is in flight', async () => {
    let resolveDelete!: () => void;
    setDatabase(
      entry,
      undefined,
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const { result } = await renderHook(() => useEditLogEntryViewModel());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      result.current.openDeleteDialog();
    });
    await act(async () => {
      result.current.handleDelete();
    });
    await waitFor(() => expect(result.current.isDeleting).toBe(true));

    await act(async () => {
      result.current.closeDeleteDialog();
    });
    expect(result.current.deleteDialogOpen).toBe(true);

    await act(async () => resolveDelete());
  });
});
