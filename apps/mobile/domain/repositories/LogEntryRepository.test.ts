import type { LogEntrySummary } from '@maintenance-log/api-client';
import type { Store, StoreQueryOptions } from '@/infrastructure/database/Store';
import { createLogEntryRepository } from './LogEntryRepository';

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

const entryA: LogEntrySummary = {
  id: 'e1',
  typeId: 'MAINTENANCE',
  title: 'Oil & filter change',
  date: '2026-06-28',
  time: null,
  mileage: 12400,
  itemCount: 3,
  mediaCount: 2,
  totalCost: '85.00',
};

const entryB: LogEntrySummary = {
  id: 'e2',
  typeId: 'REPAIR',
  title: 'Front brake pads',
  date: '2026-04-02',
  time: null,
  mileage: 11820,
  itemCount: 1,
  mediaCount: 0,
  totalCost: '60.00',
};

describe('LogEntryRepository', () => {
  it('findByVehicleId returns only that vehicle\'s entries, newest first, without leaking vehicleId', async () => {
    const { store } = fakeStore([
      { ...entryA, vehicleId: 'v1' },
      { ...entryB, vehicleId: 'v1' },
      { ...entryA, id: 'e3', vehicleId: 'v2' },
    ]);
    const repo = createLogEntryRepository(store);

    const result = await repo.findByVehicleId('v1');

    expect(result).toEqual([entryA, entryB]);
    expect(result[0]).not.toHaveProperty('vehicleId');
  });

  it('findByVehicleId returns an empty array when the vehicle has no entries', async () => {
    const { store } = fakeStore<LogEntrySummary & { vehicleId: string }>([]);
    const repo = createLogEntryRepository(store);

    expect(await repo.findByVehicleId('v1')).toEqual([]);
  });

  it('reconcile replaces the entire collection across all vehicles in one call', async () => {
    const { store, getRows } = fakeStore([{ ...entryA, vehicleId: 'v1' }]);
    const repo = createLogEntryRepository(store);

    await repo.reconcile([
      { ...entryB, vehicleId: 'v1' },
      { ...entryA, id: 'e3', vehicleId: 'v2' },
    ]);

    expect(store.replaceAll).toHaveBeenCalledTimes(1);
    expect(getRows()).toEqual([
      { ...entryB, vehicleId: 'v1' },
      { ...entryA, id: 'e3', vehicleId: 'v2' },
    ]);
  });

  it('reconcile with an empty list clears the local collection', async () => {
    const { store, getRows } = fakeStore([{ ...entryA, vehicleId: 'v1' }]);
    const repo = createLogEntryRepository(store);

    await repo.reconcile([]);

    expect(getRows()).toEqual([]);
  });
});
