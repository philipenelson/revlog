import type { VehicleSummary } from '@maintenance-log/api-client';
import type { Store, StoreQueryOptions } from '@/infrastructure/database/Store';
import type { OutboxWriter } from '@/infrastructure/database/OutboxWriter';
import { createVehicleRepository, type LocalVehicleDetail } from './VehicleRepository';

function fakeOutboxWriter<T extends { id: string }>() {
  const save = jest.fn(async (_record: T, _outboxType: string, _outboxPayload: unknown) => {});
  return { writer: { save } as OutboxWriter<T>, save };
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
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer);

    const result = await repo.findAll();

    expect(result).toEqual([vehicleA, vehicleB]);
    expect(result[0]).not.toHaveProperty('sortOrder');
    expect(result[0]).not.toHaveProperty('totalSpent');
  });

  it('reconcile replaces the collection, assigning sortOrder and defaulting detail fields', async () => {
    const { store, getRows } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([
      { ...vehicleA, ...defaultDetail, sortOrder: 0 },
    ]);
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer);

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
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer);

    await repo.reconcile([]);

    expect(getRows()).toEqual([]);
  });

  it('reconcile preserves an already-known vehicle\'s detail fields instead of resetting them', async () => {
    const { getRows, store } = fakeStore([
      {
        ...vehicleA,
        sortOrder: 0,
        totalSpent: '1840.00',
        lastLoggedAt: '2026-06-28',
        transferPending: true,
        pendingTransferRecipientEmail: 'alex@example.com',
      },
    ]);
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer);

    // vehicleA reappears in the fresh GET /vehicles list (phase 1); its
    // previously-fetched detail fields must survive this replace even
    // though VehicleSummary alone can't supply them.
    await repo.reconcile([vehicleA, vehicleB]);

    expect(getRows()).toEqual([
      {
        ...vehicleA,
        sortOrder: 0,
        totalSpent: '1840.00',
        lastLoggedAt: '2026-06-28',
        transferPending: true,
        pendingTransferRecipientEmail: 'alex@example.com',
      },
      { ...vehicleB, ...defaultDetail, sortOrder: 1 },
    ]);
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
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer);

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
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer);

    expect(await repo.findById('missing')).toBeNull();
  });

  it('applyDetail merges detail fields into the existing row', async () => {
    const { store, getRows } = fakeStore([{ ...vehicleA, ...defaultDetail, sortOrder: 0 }]);
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer);

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
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer);

    await repo.applyDetail('missing', {
      totalSpent: '0.00',
      lastLoggedAt: null,
      transferPending: false,
      pendingTransferRecipientEmail: null,
    });

    expect(store.save).not.toHaveBeenCalled();
  });

  it('update merges the given fields into the existing row and enqueues an UPDATE_VEHICLE outbox entry atomically', async () => {
    const { store } = fakeStore([{ ...vehicleA, ...defaultDetail, sortOrder: 0 }]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer);

    await repo.update('v1', { nickname: 'Widowmaker', make: 'Honda', model: 'CB650R', year: 2020, mileage: 5000 });

    expect(save).toHaveBeenCalledWith(
      { ...vehicleA, ...defaultDetail, sortOrder: 0, nickname: 'Widowmaker', year: 2020, mileage: 5000 },
      'UPDATE_VEHICLE',
      { vehicleId: 'v1', nickname: 'Widowmaker', make: 'Honda', model: 'CB650R', year: 2020, mileage: 5000 },
    );
    // The write goes through OutboxWriter, never the plain Store.save — that
    // would break the write+outbox atomicity this exists for.
    expect(store.save).not.toHaveBeenCalled();
  });

  it('update is a no-op when the vehicle does not exist locally', async () => {
    const { store } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer);

    await repo.update('missing', { nickname: null, make: 'Honda', model: 'CB650R', year: 2020, mileage: 5000 });

    expect(save).not.toHaveBeenCalled();
  });
});
