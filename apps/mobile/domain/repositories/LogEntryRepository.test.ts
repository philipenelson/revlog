import type { LogEntrySummary } from '@maintenance-log/api-client';
import type { Store, StoreQueryOptions } from '@/infrastructure/database/Store';
import type { OutboxWriter } from '@/infrastructure/database/OutboxWriter';
import { createLogEntryRepository } from './LogEntryRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'generated-id') }));

function fakeOutboxWriter<T extends { id: string }>() {
  const save = jest.fn(async (_record: T, _outboxType: string, _outboxPayload: unknown) => {});
  const remove = jest.fn(async (_id: string, _outboxType: string, _outboxPayload: unknown) => {});
  return { writer: { save, remove } as OutboxWriter<T>, save, remove };
}

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
  afterEach(() => jest.clearAllMocks());

  it('findByVehicleId returns only that vehicle\'s entries, newest first, without leaking vehicleId', async () => {
    const { store } = fakeStore([
      { ...entryA, vehicleId: 'v1' },
      { ...entryB, vehicleId: 'v1' },
      { ...entryA, id: 'e3', vehicleId: 'v2' },
    ]);
    const repo = createLogEntryRepository(store, fakeOutboxWriter().writer);

    const result = await repo.findByVehicleId('v1');

    expect(result).toEqual([entryA, entryB]);
    expect(result[0]).not.toHaveProperty('vehicleId');
  });

  it('findByVehicleId returns an empty array when the vehicle has no entries', async () => {
    const { store } = fakeStore<LogEntrySummary & { vehicleId: string }>([]);
    const repo = createLogEntryRepository(store, fakeOutboxWriter().writer);

    expect(await repo.findByVehicleId('v1')).toEqual([]);
  });

  it('reconcile replaces the entire collection across all vehicles in one call', async () => {
    const { store, getRows } = fakeStore([{ ...entryA, vehicleId: 'v1' }]);
    const repo = createLogEntryRepository(store, fakeOutboxWriter().writer);

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
    const repo = createLogEntryRepository(store, fakeOutboxWriter().writer);

    await repo.reconcile([]);

    expect(getRows()).toEqual([]);
  });

  it('create writes a local row (client-generated id, time null, mediaCount 0) and enqueues CREATE_LOG_ENTRY', async () => {
    const { store } = fakeStore<LogEntrySummary & { vehicleId: string }>([]);
    const { writer, save } = fakeOutboxWriter<LogEntrySummary & { vehicleId: string }>();
    const repo = createLogEntryRepository(store, writer);

    const id = await repo.create('v1', {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-07-04',
      mileage: 12400,
      notes: null,
      items: [],
    });

    expect(id).toBe('generated-id');
    expect(save).toHaveBeenCalledWith(
      {
        id: 'generated-id',
        vehicleId: 'v1',
        typeId: 'MAINTENANCE',
        title: 'Oil & filter change',
        date: '2026-07-04',
        time: null,
        mileage: 12400,
        itemCount: 0,
        mediaCount: 0,
        totalCost: null,
      },
      'CREATE_LOG_ENTRY',
      {
        vehicleId: 'v1',
        typeId: 'MAINTENANCE',
        title: 'Oil & filter change',
        date: '2026-07-04',
        mileage: 12400,
        notes: null,
        items: [],
      },
    );
  });

  it('create computes itemCount and totalCost from priced items, leaving unpriced items out of the total', async () => {
    const { store } = fakeStore<LogEntrySummary & { vehicleId: string }>([]);
    const { writer, save } = fakeOutboxWriter<LogEntrySummary & { vehicleId: string }>();
    const repo = createLogEntryRepository(store, writer);

    await repo.create('v1', {
      typeId: 'MAINTENANCE',
      title: 'Oil & filter change',
      date: '2026-07-04',
      mileage: 12400,
      notes: null,
      items: [
        { categoryId: 'LABOR', description: 'Oil change', quantity: null, unitCost: null },
        { categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99 },
        { categoryId: 'PART', description: '10W-40 1L', quantity: 4, unitCost: 12.5 },
      ],
    });

    const [localRow] = save.mock.calls[0]!;
    expect(localRow).toMatchObject({ itemCount: 3, totalCost: '58.99' });
  });

  it('create leaves totalCost null when no item has both quantity and unitCost', async () => {
    const { store } = fakeStore<LogEntrySummary & { vehicleId: string }>([]);
    const { writer, save } = fakeOutboxWriter<LogEntrySummary & { vehicleId: string }>();
    const repo = createLogEntryRepository(store, writer);

    await repo.create('v1', {
      typeId: 'MAINTENANCE',
      title: 'Oil change',
      date: '2026-07-04',
      mileage: 12400,
      notes: null,
      items: [{ categoryId: 'LABOR', description: 'Oil change', quantity: null, unitCost: null }],
    });

    const [localRow] = save.mock.calls[0]!;
    expect(localRow).toMatchObject({ itemCount: 1, totalCost: null });
  });
});
