import type { LogEntrySummary } from '@maintenance-log/api-client';
import type { Store, StoreQueryOptions } from '@/infrastructure/database/Store';
import type { OutboxWriter } from '@/infrastructure/database/OutboxWriter';
import { createLogEntryRepository, type LocalLogEntry } from './LogEntryRepository';

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

// Builds a full local row for fakeStore fixtures. Tests that only care about
// summary-level behaviour default the detail-cache columns to their "not yet
// fetched" state (ADR 0027's 2026-07-04 update).
function localRow(
  entry: LogEntrySummary,
  vehicleId: string,
  detail: Partial<Pick<LocalLogEntry, 'notes' | 'itemsJson' | 'detailFetched'>> = {},
): LocalLogEntry {
  return { ...entry, vehicleId, notes: null, itemsJson: '[]', detailFetched: false, ...detail };
}

describe('LogEntryRepository', () => {
  afterEach(() => jest.clearAllMocks());

  it("findByVehicleId returns only that vehicle's entries, newest first, without leaking local-only columns", async () => {
    const { store } = fakeStore([localRow(entryA, 'v1'), localRow(entryB, 'v1'), localRow({ ...entryA, id: 'e3' }, 'v2')]);
    const repo = createLogEntryRepository(store, fakeOutboxWriter<LocalLogEntry>().writer);

    const result = await repo.findByVehicleId('v1');

    expect(result).toEqual([entryA, entryB]);
    expect(result[0]).not.toHaveProperty('vehicleId');
    expect(result[0]).not.toHaveProperty('notes');
    expect(result[0]).not.toHaveProperty('itemsJson');
    expect(result[0]).not.toHaveProperty('detailFetched');
  });

  it('findByVehicleId returns an empty array when the vehicle has no entries', async () => {
    const { store } = fakeStore<LocalLogEntry>([]);
    const repo = createLogEntryRepository(store, fakeOutboxWriter<LocalLogEntry>().writer);

    expect(await repo.findByVehicleId('v1')).toEqual([]);
  });

  describe('findById', () => {
    it('returns full detail with parsed items and notes', async () => {
      const row = localRow(entryA, 'v1', {
        notes: 'Full synthetic 10W-40',
        itemsJson: JSON.stringify([{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99 }]),
        detailFetched: true,
      });
      const { store } = fakeStore([row]);
      const repo = createLogEntryRepository(store, fakeOutboxWriter<LocalLogEntry>().writer);

      const result = await repo.findById('e1');

      expect(result).toEqual({
        id: 'e1',
        typeId: 'MAINTENANCE',
        title: 'Oil & filter change',
        date: '2026-06-28',
        time: null,
        mileage: 12400,
        notes: 'Full synthetic 10W-40',
        items: [{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99 }],
      });
    });

    it('returns null when the entry is not known locally', async () => {
      const { store } = fakeStore<LocalLogEntry>([]);
      const repo = createLogEntryRepository(store, fakeOutboxWriter<LocalLogEntry>().writer);

      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('reconcile', () => {
    it('replaces the entire collection across all vehicles in one call', async () => {
      const { store, getRows } = fakeStore([localRow(entryA, 'v1')]);
      const repo = createLogEntryRepository(store, fakeOutboxWriter<LocalLogEntry>().writer);

      await repo.reconcile([
        { ...entryB, vehicleId: 'v1' },
        { ...entryA, id: 'e3', vehicleId: 'v2' },
      ]);

      expect(store.replaceAll).toHaveBeenCalledTimes(1);
      expect(getRows()).toEqual([localRow(entryB, 'v1'), localRow({ ...entryA, id: 'e3' }, 'v2')]);
    });

    it('with an empty list clears the local collection and returns no ids needing detail', async () => {
      const { store, getRows } = fakeStore([localRow(entryA, 'v1')]);
      const repo = createLogEntryRepository(store, fakeOutboxWriter<LocalLogEntry>().writer);

      const needsDetail = await repo.reconcile([]);

      expect(getRows()).toEqual([]);
      expect(needsDetail).toEqual([]);
    });

    it('returns ids not yet detail-fetched, and carries forward cached detail for ones that already are', async () => {
      const fetchedRow = localRow(entryA, 'v1', {
        notes: 'Cached notes',
        itemsJson: JSON.stringify([{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99 }]),
        detailFetched: true,
      });
      const { store, getRows } = fakeStore([fetchedRow]);
      const repo = createLogEntryRepository(store, fakeOutboxWriter<LocalLogEntry>().writer);

      const needsDetail = await repo.reconcile([
        { ...entryA, vehicleId: 'v1' },
        { ...entryB, vehicleId: 'v1' },
      ]);

      expect(needsDetail).toEqual(['e2']);
      expect(getRows()).toEqual([fetchedRow, localRow(entryB, 'v1')]);
    });
  });

  describe('applyDetail', () => {
    it('merges notes and items into an existing row and marks it detail-fetched', async () => {
      const { store, getRows } = fakeStore([localRow(entryA, 'v1')]);
      const repo = createLogEntryRepository(store, fakeOutboxWriter<LocalLogEntry>().writer);

      await repo.applyDetail('e1', {
        notes: 'Full synthetic 10W-40',
        items: [{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99 }],
      });

      expect(getRows()).toEqual([
        localRow(entryA, 'v1', {
          notes: 'Full synthetic 10W-40',
          itemsJson: JSON.stringify([{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 8.99 }]),
          detailFetched: true,
        }),
      ]);
    });

    it('is a no-op when the entry is not known locally', async () => {
      const { store } = fakeStore<LocalLogEntry>([]);
      const repo = createLogEntryRepository(store, fakeOutboxWriter<LocalLogEntry>().writer);

      await repo.applyDetail('missing', { notes: null, items: [] });

      expect(store.save).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('writes a local row (client-generated id, time null, mediaCount 0, detail cached immediately) and enqueues CREATE_LOG_ENTRY', async () => {
      const { store } = fakeStore<LocalLogEntry>([]);
      const { writer, save } = fakeOutboxWriter<LocalLogEntry>();
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
          notes: null,
          itemsJson: '[]',
          detailFetched: true,
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

    it('computes itemCount and totalCost from priced items, leaving unpriced items out of the total', async () => {
      const { store } = fakeStore<LocalLogEntry>([]);
      const { writer, save } = fakeOutboxWriter<LocalLogEntry>();
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

      const [localRowArg] = save.mock.calls[0]!;
      expect(localRowArg).toMatchObject({ itemCount: 3, totalCost: '58.99', detailFetched: true });
    });

    it('leaves totalCost null when no item has both quantity and unitCost', async () => {
      const { store } = fakeStore<LocalLogEntry>([]);
      const { writer, save } = fakeOutboxWriter<LocalLogEntry>();
      const repo = createLogEntryRepository(store, writer);

      await repo.create('v1', {
        typeId: 'MAINTENANCE',
        title: 'Oil change',
        date: '2026-07-04',
        mileage: 12400,
        notes: null,
        items: [{ categoryId: 'LABOR', description: 'Oil change', quantity: null, unitCost: null }],
      });

      const [localRowArg] = save.mock.calls[0]!;
      expect(localRowArg).toMatchObject({ itemCount: 1, totalCost: null });
    });
  });

  describe('update', () => {
    it('applies changes to the local row and enqueues UPDATE_LOG_ENTRY with the vehicleId and entryId', async () => {
      const existingRow = localRow(entryA, 'v1', { notes: 'old notes', detailFetched: true });
      const { store } = fakeStore([existingRow]);
      const { writer, save } = fakeOutboxWriter<LocalLogEntry>();
      const repo = createLogEntryRepository(store, writer);

      await repo.update('v1', 'e1', {
        typeId: 'REPAIR',
        title: 'Front brake pads',
        date: '2026-07-04',
        mileage: 12500,
        notes: 'New pads',
        items: [{ categoryId: 'PART', description: 'Brake pads', quantity: 1, unitCost: 45 }],
      });

      expect(save).toHaveBeenCalledWith(
        {
          ...existingRow,
          typeId: 'REPAIR',
          title: 'Front brake pads',
          date: '2026-07-04',
          mileage: 12500,
          itemCount: 1,
          totalCost: '45.00',
          notes: 'New pads',
          itemsJson: JSON.stringify([{ categoryId: 'PART', description: 'Brake pads', quantity: 1, unitCost: 45 }]),
          detailFetched: true,
        },
        'UPDATE_LOG_ENTRY',
        {
          vehicleId: 'v1',
          entryId: 'e1',
          typeId: 'REPAIR',
          title: 'Front brake pads',
          date: '2026-07-04',
          mileage: 12500,
          notes: 'New pads',
          items: [{ categoryId: 'PART', description: 'Brake pads', quantity: 1, unitCost: 45 }],
        },
      );
    });

    it('is a no-op when the entry is not known locally', async () => {
      const { store } = fakeStore<LocalLogEntry>([]);
      const { writer, save } = fakeOutboxWriter<LocalLogEntry>();
      const repo = createLogEntryRepository(store, writer);

      await repo.update('v1', 'missing', {
        typeId: 'MAINTENANCE',
        title: 'Oil change',
        date: '2026-07-04',
        mileage: 1000,
        notes: null,
        items: [],
      });

      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('removes the local row and enqueues DELETE_LOG_ENTRY with the vehicleId and entryId', async () => {
      const { store } = fakeStore([localRow(entryA, 'v1')]);
      const { writer, remove } = fakeOutboxWriter<LocalLogEntry>();
      const repo = createLogEntryRepository(store, writer);

      await repo.delete('v1', 'e1');

      expect(remove).toHaveBeenCalledWith('e1', 'DELETE_LOG_ENTRY', { vehicleId: 'v1', entryId: 'e1' });
    });

    it('is a no-op when the entry is not known locally', async () => {
      const { store } = fakeStore<LocalLogEntry>([]);
      const { writer, remove } = fakeOutboxWriter<LocalLogEntry>();
      const repo = createLogEntryRepository(store, writer);

      await repo.delete('v1', 'missing');

      expect(remove).not.toHaveBeenCalled();
    });
  });
});
