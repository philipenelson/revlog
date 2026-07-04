import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import type { LocalVehicleDetail } from '@/domain/repositories/VehicleRepository';
import { todayIso } from '@/utils/date';
import { useNewLogEntryViewModel } from './useNewLogEntryViewModel';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ vehicleId: 'v1' })),
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

function setDatabase(createImpl?: () => Promise<string>) {
  const create = jest.fn(createImpl ?? (async () => 'new-entry-id'));
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: { findById: jest.fn(async () => vehicle) } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: { create } as any,
  });
  return create;
}

describe('useNewLogEntryViewModel', () => {
  afterEach(() => jest.clearAllMocks());

  it('defaults date to today, mileage/title/notes empty, and no type selected', async () => {
    setDatabase();

    const { result } = await renderHook(() => useNewLogEntryViewModel());

    expect(result.current.fields).toEqual({ typeId: '', title: '', date: todayIso(), mileage: '', notes: '' });
    expect(result.current.items).toEqual([]);
    expect(result.current.errors).toEqual({});
  });

  it('loads the vehicle display name for the header back-link', async () => {
    setDatabase();

    const { result } = await renderHook(() => useNewLogEntryViewModel());

    await waitFor(() => expect(result.current.vehicleName).toBe('Blackbird'));
  });

  it('blocks submission and surfaces field errors when type, title, and mileage are missing', async () => {
    const create = setDatabase();

    const { result } = await renderHook(() => useNewLogEntryViewModel());

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.errors.typeId).toBeTruthy();
    expect(result.current.errors.title).toBeTruthy();
    expect(result.current.errors.mileage).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as that field is edited', async () => {
    setDatabase();

    const { result } = await renderHook(() => useNewLogEntryViewModel());

    await act(async () => {
      result.current.submit();
    });
    expect(result.current.errors.title).toBeTruthy();

    await act(async () => {
      result.current.updateField('title', 'Oil change');
    });

    expect(result.current.errors.title).toBeUndefined();
  });

  it('creates via logEntryRepository.create with a minimal entry and navigates back on success', async () => {
    const create = setDatabase();

    const { result } = await renderHook(() => useNewLogEntryViewModel());

    await act(async () => {
      result.current.updateField('typeId', 'MAINTENANCE');
      result.current.updateField('title', 'Oil & filter change');
      result.current.updateField('mileage', '12400');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(create).toHaveBeenCalledWith('v1', {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: result.current.fields.date,
      mileage: 12400,
      notes: null,
      items: [],
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('strips commas from mileage before validating and saving', async () => {
    const create = setDatabase();

    const { result } = await renderHook(() => useNewLogEntryViewModel());

    await act(async () => {
      result.current.updateField('typeId', 'MAINTENANCE');
      result.current.updateField('title', 'Oil change');
      result.current.updateField('mileage', '12,400');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(create).toHaveBeenCalledWith('v1', expect.objectContaining({ mileage: 12400 }));
  });

  it('leaves notes null when left blank, and trims when provided', async () => {
    const create = setDatabase();

    const { result } = await renderHook(() => useNewLogEntryViewModel());

    await act(async () => {
      result.current.updateField('typeId', 'MAINTENANCE');
      result.current.updateField('title', 'Oil change');
      result.current.updateField('mileage', '12400');
      result.current.updateField('notes', '  Full synthetic 10W-40  ');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(create).toHaveBeenCalledWith('v1', expect.objectContaining({ notes: 'Full synthetic 10W-40' }));
  });

  it('adds, edits, and removes items, computing row and grand totals', async () => {
    setDatabase();

    const { result } = await renderHook(() => useNewLogEntryViewModel());

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
      result.current.addItem();
    });
    const secondId = result.current.items[1]!.id;
    await act(async () => {
      result.current.updateItem(secondId, { description: 'Oil change', categoryId: 'LABOR' });
    });
    // No quantity/unitCost on the second item -- excluded from the total, same as the web draft.
    expect(result.current.itemsTotal).toBe('17.00');

    await act(async () => {
      result.current.removeItem(itemId);
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.itemsTotal).toBeNull();
  });

  it('sends priced items and drops rows left with a blank description', async () => {
    const create = setDatabase();

    const { result } = await renderHook(() => useNewLogEntryViewModel());

    await act(async () => {
      result.current.addItem();
      result.current.addItem();
    });
    const [priced, blank] = result.current.items;
    await act(async () => {
      result.current.updateItem(priced!.id, { description: 'Oil filter', quantity: '1', unitCost: '8.99' });
      result.current.updateItem(blank!.id, { description: '   ' });
      result.current.updateField('typeId', 'MAINTENANCE');
      result.current.updateField('title', 'Oil change');
      result.current.updateField('mileage', '12400');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(create).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({
        items: [{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99 }],
      }),
    );
  });

  it('shows a submit error and does not navigate when the local write throws', async () => {
    setDatabase(async () => {
      throw new Error('disk full');
    });

    const { result } = await renderHook(() => useNewLogEntryViewModel());

    await act(async () => {
      result.current.updateField('typeId', 'MAINTENANCE');
      result.current.updateField('title', 'Oil change');
      result.current.updateField('mileage', '12400');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(result.current.submitError).toBe("Couldn't save this log entry. Try again in a moment.");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('onDateSelected updates the date field and keeps the picker open only on iOS', async () => {
    setDatabase();
    Platform.OS = 'android';

    const { result } = await renderHook(() => useNewLogEntryViewModel());
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
    setDatabase();

    const { result } = await renderHook(() => useNewLogEntryViewModel());
    await act(async () => {
      result.current.openDatePicker();
    });

    await act(async () => {
      result.current.onDatePickerDismiss();
    });

    expect(result.current.isDatePickerOpen).toBe(false);
  });

  it('onCancel navigates back', async () => {
    setDatabase();

    const { result } = await renderHook(() => useNewLogEntryViewModel());
    result.current.onCancel();

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
