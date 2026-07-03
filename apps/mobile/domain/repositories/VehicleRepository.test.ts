import type { VehicleSummary } from '@maintenance-log/api-client';
import type { Store, StoreQueryOptions } from '@/infrastructure/database/Store';
import { createVehicleRepository, type LocalVehicleDetail } from './VehicleRepository';

function fakeStore<T extends { id: string }>(initial: T[] = []) {
  let rows = initial;
  const store: Store<T> = {
    getAll: jest.fn(async (options?: StoreQueryOptions<T>) => {
      let result = rows;
      if (options?.where) {
        const entries = Object.entries(options.where) as [keyof T, unknown][];
        result = result.filter((row) => entries.every(([field, value]) => row[field] === value));
      }
      if (options?.orderBy) {
        const { field, direction } = options.orderBy;
        result = [...result].sort((a, b) => {
          const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
          return direction === 'desc' ? -cmp : cmp;
        });
      }
      return result;
    }),
    save: jest.fn(async (record: T) => {
      rows = [...rows.filter((r) => r.id !== record.id), record];
    }),
    remove: jest.fn(async (id: string) => {
      rows = rows.filter((r) => r.id !== id);
    }),
    replaceAll: jest.fn(async (records: T[]) => {
      rows = records;
    }),
  };
  return { store, getRows: () => rows };
}

const vehicleA: VehicleSummary = {
  id: 'v1',
  nickname: 'Blackbird',
  make: 'Honda',
  model: 'CB650R',
  year: 2019,
  mileage: 4200,
  photoUrl: null,
  logEntryCount: 14,
};

const vehicleB: VehicleSummary = {
  id: 'v2',
  nickname: null,
  make: 'KTM',
  model: '390 Duke',
  year: 2021,
  mileage: 1800,
  photoUrl: null,
  logEntryCount: 0,
};

const defaultDetail = {
  totalSpent: null,
  lastLoggedAt: null,
  transferPending: false,
  pendingTransferRecipientEmail: null,
};

describe('VehicleRepository', () => {
  it('findAll returns vehicles ordered by sortOrder, without leaking sortOrder or detail fields', async () => {
    const { store } = fakeStore([
      { ...vehicleB, ...defaultDetail, sortOrder: 1 },
      { ...vehicleA, ...defaultDetail, sortOrder: 0 },
    ]);
    const repo = createVehicleRepository(store);

    const result = await repo.findAll();

    expect(result).toEqual([vehicleA, vehicleB]);
    expect(result[0]).not.toHaveProperty('sortOrder');
    expect(result[0]).not.toHaveProperty('totalSpent');
  });

  it('reconcile replaces the collection, assigning sortOrder and defaulting detail fields', async () => {
    const { store, getRows } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([
      { ...vehicleA, ...defaultDetail, sortOrder: 0 },
    ]);
    const repo = createVehicleRepository(store);

    await repo.reconcile([vehicleB, vehicleA]);

    expect(store.replaceAll).toHaveBeenCalledTimes(1);
    expect(getRows()).toEqual([
      { ...vehicleB, ...defaultDetail, sortOrder: 0 },
      { ...vehicleA, ...defaultDetail, sortOrder: 1 },
    ]);
  });

  it('reconcile with an empty list clears the local collection', async () => {
    const { store, getRows } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([
      { ...vehicleA, ...defaultDetail, sortOrder: 0 },
    ]);
    const repo = createVehicleRepository(store);

    await repo.reconcile([]);

    expect(getRows()).toEqual([]);
  });

  it('findById returns the vehicle with detail fields, without leaking sortOrder', async () => {
    const { store } = fakeStore([
      {
        ...vehicleA,
        sortOrder: 0,
        totalSpent: '1840.00',
        lastLoggedAt: '2026-06-28',
        transferPending: false,
        pendingTransferRecipientEmail: null,
      },
    ]);
    const repo = createVehicleRepository(store);

    const result = await repo.findById('v1');

    expect(result).toEqual({
      ...vehicleA,
      totalSpent: '1840.00',
      lastLoggedAt: '2026-06-28',
      transferPending: false,
      pendingTransferRecipientEmail: null,
    });
    expect(result).not.toHaveProperty('sortOrder');
  });

  it('findById returns null when the vehicle does not exist locally', async () => {
    const { store } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([]);
    const repo = createVehicleRepository(store);

    expect(await repo.findById('missing')).toBeNull();
  });

  it('applyDetail merges detail fields into the existing row', async () => {
    const { store, getRows } = fakeStore([{ ...vehicleA, ...defaultDetail, sortOrder: 0 }]);
    const repo = createVehicleRepository(store);

    await repo.applyDetail('v1', {
      totalSpent: '1840.00',
      lastLoggedAt: '2026-06-28',
      transferPending: true,
      pendingTransferRecipientEmail: 'alex@example.com',
    });

    expect(getRows()).toEqual([
      {
        ...vehicleA,
        sortOrder: 0,
        totalSpent: '1840.00',
        lastLoggedAt: '2026-06-28',
        transferPending: true,
        pendingTransferRecipientEmail: 'alex@example.com',
      },
    ]);
  });

  it('applyDetail is a no-op when the vehicle no longer exists locally', async () => {
    const { store } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([]);
    const repo = createVehicleRepository(store);

    await repo.applyDetail('missing', {
      totalSpent: '0.00',
      lastLoggedAt: null,
      transferPending: false,
      pendingTransferRecipientEmail: null,
    });

    expect(store.save).not.toHaveBeenCalled();
  });
});
