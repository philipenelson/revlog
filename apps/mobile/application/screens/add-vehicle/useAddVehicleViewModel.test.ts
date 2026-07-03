import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useAddVehicleViewModel } from './useAddVehicleViewModel';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));

import { useDatabase } from '@/application/providers/DatabaseProvider';

const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
const mockBack = router.back as jest.Mock;
const mockReplace = router.replace as jest.Mock;

function setDatabase(createImpl?: () => Promise<string>) {
  const create = jest.fn(createImpl ?? (async () => 'new-vehicle-id'));
  mockUseDatabase.mockReturnValue({
    isReady: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicleRepository: { create } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outboxRepository: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEntryRepository: {} as any,
  });
  return create;
}

describe('useAddVehicleViewModel', () => {
  afterEach(() => jest.clearAllMocks());

  it('starts with empty fields and no errors', async () => {
    setDatabase();

    const { result } = await renderHook(() => useAddVehicleViewModel());

    expect(result.current.fields).toEqual({ nickname: '', make: '', model: '', year: '', mileage: '' });
    expect(result.current.errors).toEqual({});
  });

  it('blocks submission and surfaces field errors when required fields are invalid', async () => {
    setDatabase();

    const { result } = await renderHook(() => useAddVehicleViewModel());

    await act(async () => {
      result.current.submit();
    });

    expect(result.current.errors.make).toBeTruthy();
    expect(result.current.errors.model).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as that field is edited', async () => {
    setDatabase();

    const { result } = await renderHook(() => useAddVehicleViewModel());

    await act(async () => {
      result.current.submit();
    });
    expect(result.current.errors.make).toBeTruthy();

    await act(async () => {
      result.current.updateField('make', 'Honda');
    });

    expect(result.current.errors.make).toBeUndefined();
  });

  it('creates via vehicleRepository.create and replaces the route with the new Vehicle Detail screen on success', async () => {
    const create = setDatabase();

    const { result } = await renderHook(() => useAddVehicleViewModel());

    await act(async () => {
      result.current.updateField('make', 'Honda');
      result.current.updateField('model', 'CB650R');
      result.current.updateField('year', '2019');
      result.current.updateField('mileage', '4200');
      result.current.updateField('nickname', 'Blackbird');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(create).toHaveBeenCalledWith({
      nickname: 'Blackbird',
      make: 'Honda',
      model: 'CB650R',
      year: 2019,
      mileage: 4200,
    });
    // replace(), not push()/back() -- Add Vehicle was itself reached by
    // pushing from Garage, so replacing it means a single back() from
    // Detail returns to Garage, not to a stale, already-submitted form.
    expect(mockReplace).toHaveBeenCalledWith('/garage/new-vehicle-id');
  });

  it('leaves nickname null when left blank', async () => {
    const create = setDatabase();

    const { result } = await renderHook(() => useAddVehicleViewModel());

    await act(async () => {
      result.current.updateField('make', 'Honda');
      result.current.updateField('model', 'CB650R');
      result.current.updateField('year', '2019');
      result.current.updateField('mileage', '4200');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ nickname: null }));
  });

  it('strips commas from mileage before validating and saving', async () => {
    const create = setDatabase();

    const { result } = await renderHook(() => useAddVehicleViewModel());

    await act(async () => {
      result.current.updateField('make', 'Honda');
      result.current.updateField('model', 'CB650R');
      result.current.updateField('year', '2019');
      result.current.updateField('mileage', '12,500');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ mileage: 12500 }));
  });

  it('shows a submit error and does not navigate when the local write throws', async () => {
    setDatabase(async () => {
      throw new Error('disk full');
    });

    const { result } = await renderHook(() => useAddVehicleViewModel());

    await act(async () => {
      result.current.updateField('make', 'Honda');
      result.current.updateField('model', 'CB650R');
      result.current.updateField('year', '2019');
      result.current.updateField('mileage', '4200');
    });
    await act(async () => {
      result.current.submit();
    });

    expect(result.current.submitError).toBe("Couldn't save your vehicle. Try again in a moment.");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('onCancel navigates back', async () => {
    setDatabase();

    const { result } = await renderHook(() => useAddVehicleViewModel());
    result.current.onCancel();

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
