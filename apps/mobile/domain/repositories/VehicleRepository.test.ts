import type { VehicleSummary } from '@maintenance-log/api-client';
import type { Store, StoreQueryOptions } from '@/infrastructure/database/Store';
import { createVehicleRepository } from './VehicleRepository';

function fakeStore<T extends { id: string }>(initial: T[] = []) {
  let rows = initial;
  const store: Store<T> = {
    getAll: jest.fn(async (options?: StoreQueryOptions<T>) => {
      let result = rows;
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

describe('VehicleRepository', () => {
  it('findAll returns vehicles ordered by sortOrder, without leaking sortOrder', async () => {
    const { store } = fakeStore([
      { ...vehicleB, sortOrder: 1 },
      { ...vehicleA, sortOrder: 0 },
    ]);
    const repo = createVehicleRepository(store);

    const result = await repo.findAll();

    expect(result).toEqual([vehicleA, vehicleB]);
    expect(result[0]).not.toHaveProperty('sortOrder');
  });

  it('reconcile replaces the collection, assigning sortOrder from array index', async () => {
    const { store, getRows } = fakeStore<VehicleSummary & { sortOrder: number }>([{ ...vehicleA, sortOrder: 0 }]);
    const repo = createVehicleRepository(store);

    await repo.reconcile([vehicleB, vehicleA]);

    expect(store.replaceAll).toHaveBeenCalledTimes(1);
    expect(getRows()).toEqual([
      { ...vehicleB, sortOrder: 0 },
      { ...vehicleA, sortOrder: 1 },
    ]);
  });

  it('reconcile with an empty list clears the local collection', async () => {
    const { store, getRows } = fakeStore<VehicleSummary & { sortOrder: number }>([{ ...vehicleA, sortOrder: 0 }]);
    const repo = createVehicleRepository(store);

    await repo.reconcile([]);

    expect(getRows()).toEqual([]);
  });
});
