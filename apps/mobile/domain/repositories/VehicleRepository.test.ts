import type { VehicleSummary } from '@maintenance-log/api-client';
import type { Store, StoreQueryOptions } from '@/domain/ports/Store';
import type { OutboxWriter } from '@/domain/ports/OutboxWriter';
import type { PhotoStore, PickedPhoto, StablePhoto } from '@/domain/ports/PhotoStore';
import { createVehicleRepository, type LocalVehicleDetail } from './VehicleRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'generated-id') }));

// Injected fake for the PhotoStore port (ADR 0041) — replaces the former
// jest.mock of the concrete photoStorage module now that the repository takes
// the port as a constructor argument. A fresh one is built per test (beforeEach).
function fakePhotoStore() {
  const persist = jest.fn(
    async (_vehicleId: string, _photo: PickedPhoto): Promise<StablePhoto> => ({ uri: '', name: '', type: '' }),
  );
  const remove = jest.fn((_uri: string) => {});
  return { photoStore: { persist, remove } as PhotoStore, persist, remove };
}

let photoStoreFake: ReturnType<typeof fakePhotoStore>;

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
  beforeEach(() => {
    photoStoreFake = fakePhotoStore();
  });
  afterEach(() => jest.clearAllMocks());

  it('findAll returns vehicles ordered by sortOrder, without leaking sortOrder or detail fields', async () => {
    const { store } = fakeStore([
      { ...vehicleB, ...defaultDetail, sortOrder: 1 },
      { ...vehicleA, ...defaultDetail, sortOrder: 0 },
    ]);
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer, photoStoreFake.photoStore);

    const result = await repo.findAll();

    expect(result).toEqual([vehicleA, vehicleB]);
    expect(result[0]).not.toHaveProperty('sortOrder');
    expect(result[0]).not.toHaveProperty('totalSpent');
  });

  it('reconcile replaces the collection, assigning sortOrder and defaulting detail fields', async () => {
    const { store, getRows } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([
      { ...vehicleA, ...defaultDetail, sortOrder: 0 },
    ]);
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer, photoStoreFake.photoStore);

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
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer, photoStoreFake.photoStore);

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
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer, photoStoreFake.photoStore);

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
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer, photoStoreFake.photoStore);

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
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer, photoStoreFake.photoStore);

    expect(await repo.findById('missing')).toBeNull();
  });

  it('create writes a new row with a generated id and default detail fields, and enqueues a CREATE_VEHICLE outbox entry atomically', async () => {
    const { store, getRows } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    const id = await repo.create({ nickname: 'Blackbird', make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });

    expect(id).toBe('generated-id');
    expect(save).toHaveBeenCalledWith(
      {
        id: 'generated-id',
        nickname: 'Blackbird',
        make: 'Honda',
        model: 'CB650R',
        year: 2019,
        mileage: 4200,
        photoUrl: null,
        logEntryCount: 0,
        ...defaultDetail,
        sortOrder: 0,
      },
      'CREATE_VEHICLE',
      { id: 'generated-id', nickname: 'Blackbird', make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 },
    );
    // The write goes through OutboxWriter, never the plain Store.save.
    expect(store.save).not.toHaveBeenCalled();
    expect(getRows()).toEqual([]); // fakeOutboxWriter doesn't touch the store
  });

  it('create sorts a new vehicle ahead of existing ones', async () => {
    const { store } = fakeStore([{ ...vehicleA, ...defaultDetail, sortOrder: 0 }]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.create({ nickname: null, make: 'KTM', model: '390 Duke', year: 2021, mileage: 1800 });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: -1 }),
      'CREATE_VEHICLE',
      expect.anything(),
    );
  });

  it('create persists a picked photo locally and includes the stable reference in the outbox payload', async () => {
    const { store } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);
    const pickedPhoto = { uri: 'file:///tmp/picker-cache/abc.jpg', name: 'photo.jpg', type: 'image/jpeg' };
    const stablePhoto = { uri: 'file:///documents/vehicle-photos/generated-id.jpg', name: 'photo.jpg', type: 'image/jpeg' };
    photoStoreFake.persist.mockResolvedValue(stablePhoto);

    await repo.create({ nickname: null, make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 }, pickedPhoto);

    expect(photoStoreFake.persist).toHaveBeenCalledWith('generated-id', pickedPhoto);
    expect(save).toHaveBeenCalledWith(
      // photoUrl is the stable local file, not null -- Garage/Vehicle
      // Detail render it immediately, before the create has even reached
      // the server. reconcile() overwrites it with the real url once
      // confirmed.
      expect.objectContaining({ photoUrl: stablePhoto.uri }),
      'CREATE_VEHICLE',
      expect.objectContaining({ photo: stablePhoto }),
    );
  });

  it('create does not touch photo storage when no photo is given', async () => {
    const { store } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.create({ nickname: null, make: 'Honda', model: 'CB650R', year: 2019, mileage: 4200 });

    expect(photoStoreFake.persist).not.toHaveBeenCalled();
    const [, , payload] = save.mock.calls[0]!;
    expect(payload).not.toHaveProperty('photo');
  });

  it('applyDetail merges detail fields into the existing row', async () => {
    const { store, getRows } = fakeStore([{ ...vehicleA, ...defaultDetail, sortOrder: 0 }]);
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer, photoStoreFake.photoStore);

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
    const repo = createVehicleRepository(store, fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>().writer, photoStoreFake.photoStore);

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
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

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
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.update('missing', { nickname: null, make: 'Honda', model: 'CB650R', year: 2020, mileage: 5000 });

    expect(save).not.toHaveBeenCalled();
  });

  it('update persists a picked replacement photo locally and includes the stable reference in the outbox payload', async () => {
    const { store } = fakeStore([{ ...vehicleA, ...defaultDetail, sortOrder: 0 }]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);
    const pickedPhoto = { uri: 'file:///tmp/picker-cache/abc.jpg', name: 'photo.jpg', type: 'image/jpeg' };
    const stablePhoto = { uri: 'file:///documents/vehicle-photos/v1.jpg', name: 'photo.jpg', type: 'image/jpeg' };
    photoStoreFake.persist.mockResolvedValue(stablePhoto);

    await repo.update(
      'v1',
      { nickname: 'Widowmaker', make: 'Honda', model: 'CB650R', year: 2020, mileage: 5000 },
      pickedPhoto,
    );

    expect(photoStoreFake.persist).toHaveBeenCalledWith('v1', pickedPhoto);
    expect(save).toHaveBeenCalledWith(
      // photoUrl is the stable local file, not the row's previous value --
      // Garage/Vehicle Detail render it immediately, before the update has
      // even reached the server. reconcile() overwrites it with the real
      // url once confirmed.
      expect.objectContaining({ photoUrl: stablePhoto.uri }),
      'UPDATE_VEHICLE',
      expect.objectContaining({ photo: stablePhoto }),
    );
  });

  it('update does not touch photo storage when no photo is given', async () => {
    const { store } = fakeStore([{ ...vehicleA, ...defaultDetail, sortOrder: 0 }]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.update('v1', { nickname: 'Widowmaker', make: 'Honda', model: 'CB650R', year: 2020, mileage: 5000 });

    expect(photoStoreFake.persist).not.toHaveBeenCalled();
    const [updatedRow, , payload] = save.mock.calls[0]!;
    expect((updatedRow as { photoUrl: string | null }).photoUrl).toBe(vehicleA.photoUrl);
    expect(payload).not.toHaveProperty('photo');
  });

  it('delete removes the local row and enqueues a DELETE_VEHICLE outbox entry atomically', async () => {
    const { store } = fakeStore([{ ...vehicleA, ...defaultDetail, sortOrder: 0 }]);
    const { writer, remove } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.delete('v1');

    expect(remove).toHaveBeenCalledWith('v1', 'DELETE_VEHICLE', { vehicleId: 'v1' });
    // The write goes through OutboxWriter, never the plain Store.remove --
    // that would break the delete+outbox atomicity this exists for.
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('delete is a no-op when the vehicle does not exist locally', async () => {
    const { store } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([]);
    const { writer, remove } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.delete('missing');

    expect(remove).not.toHaveBeenCalled();
    expect(photoStoreFake.remove).not.toHaveBeenCalled();
  });

  it('delete cleans up a not-yet-synced local photo file before enqueuing the outbox entry', async () => {
    const { store } = fakeStore([
      { ...vehicleA, ...defaultDetail, sortOrder: 0, photoUrl: 'file:///documents/vehicle-photos/v1.jpg' },
    ]);
    const { writer } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.delete('v1');

    expect(photoStoreFake.remove).toHaveBeenCalledWith('file:///documents/vehicle-photos/v1.jpg');
  });

  it('delete leaves a reconciled (remote) photo url alone', async () => {
    const { store } = fakeStore([
      { ...vehicleA, ...defaultDetail, sortOrder: 0, photoUrl: 'https://cdn.example.com/v1.jpg' },
    ]);
    const { writer } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.delete('v1');

    expect(photoStoreFake.remove).not.toHaveBeenCalled();
  });

  it('initiateTransfer marks the row transferPending and enqueues an INITIATE_TRANSFER outbox entry atomically', async () => {
    const { store } = fakeStore([{ ...vehicleA, ...defaultDetail, sortOrder: 0 }]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.initiateTransfer('v1', 'buyer@example.com');

    expect(save).toHaveBeenCalledWith(
      {
        ...vehicleA,
        ...defaultDetail,
        sortOrder: 0,
        transferPending: true,
        pendingTransferRecipientEmail: 'buyer@example.com',
      },
      'INITIATE_TRANSFER',
      { vehicleId: 'v1', recipientEmail: 'buyer@example.com' },
    );
    expect(store.save).not.toHaveBeenCalled();
  });

  it('initiateTransfer is a no-op when the vehicle does not exist locally', async () => {
    const { store } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.initiateTransfer('missing', 'buyer@example.com');

    expect(save).not.toHaveBeenCalled();
  });

  it('cancelTransfer clears transferPending and enqueues a CANCEL_TRANSFER outbox entry atomically', async () => {
    const { store } = fakeStore([
      {
        ...vehicleA,
        ...defaultDetail,
        sortOrder: 0,
        transferPending: true,
        pendingTransferRecipientEmail: 'buyer@example.com',
      },
    ]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.cancelTransfer('v1');

    expect(save).toHaveBeenCalledWith(
      { ...vehicleA, ...defaultDetail, sortOrder: 0, transferPending: false, pendingTransferRecipientEmail: null },
      'CANCEL_TRANSFER',
      { vehicleId: 'v1' },
    );
    expect(store.save).not.toHaveBeenCalled();
  });

  it('cancelTransfer is a no-op when the vehicle does not exist locally', async () => {
    const { store } = fakeStore<LocalVehicleDetail & { sortOrder: number }>([]);
    const { writer, save } = fakeOutboxWriter<LocalVehicleDetail & { sortOrder: number }>();
    const repo = createVehicleRepository(store, writer, photoStoreFake.photoStore);

    await repo.cancelTransfer('missing');

    expect(save).not.toHaveBeenCalled();
  });
});
