import type { HttpClient } from '@maintenance-log/api-client';
import type { VehicleDetail, VehicleSummary } from '@maintenance-log/api-client';
import type { VehicleRepository } from '@/domain/repositories/VehicleRepository';
import type { LogEntryRepository } from '@/domain/repositories/LogEntryRepository';
import type { OutboxEntry, OutboxRepository } from '@/domain/repositories/OutboxRepository';
import { createSyncService, RetryableOutboxError } from './SyncService';

jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  listVehicles: jest.fn(),
  getVehicle: jest.fn(),
}));

import { listVehicles, getVehicle } from '@maintenance-log/api-client';

const mockListVehicles = listVehicles as jest.MockedFunction<typeof listVehicles>;
const mockGetVehicle = getVehicle as jest.MockedFunction<typeof getVehicle>;

const fakeClient = {} as HttpClient;

function fakeVehicleRepository(): jest.Mocked<VehicleRepository> {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    reconcile: jest.fn(),
    applyDetail: jest.fn(),
  };
}

function fakeLogEntryRepository(): jest.Mocked<LogEntryRepository> {
  return { findByVehicleId: jest.fn(async (_vehicleId: string) => []), reconcile: jest.fn() };
}

function fakeOutboxRepository(entries: OutboxEntry[]): jest.Mocked<OutboxRepository> {
  const statuses = new Map(entries.map((e) => [e.id, e.status]));
  return {
    enqueue: jest.fn(),
    listPending: jest.fn(async () => entries.filter((e) => statuses.get(e.id) === 'pending')),
    markStatus: jest.fn(async (id, status) => {
      statuses.set(id, status);
    }),
    remove: jest.fn(),
  };
}

const vehicle: VehicleSummary = {
  id: 'v1',
  nickname: 'Blackbird',
  make: 'Honda',
  model: 'CB650R',
  year: 2019,
  mileage: 4200,
  photoUrl: null,
  logEntryCount: 14,
};

function vehicleDetail(overrides: Partial<VehicleDetail> = {}): VehicleDetail {
  return {
    id: vehicle.id,
    nickname: vehicle.nickname,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    mileage: vehicle.mileage,
    photoUrl: vehicle.photoUrl,
    insurance: null,
    logEntries: [],
    stats: { totalSpent: '0.00', lastLoggedAt: null },
    transferPending: false,
    pendingTransfer: null,
    ...overrides,
  };
}

function entry(id: string, createdAt: number, type = 'CREATE_VEHICLE'): OutboxEntry {
  return { id, type, payload: '{}', createdAt, status: 'pending' };
}

describe('SyncService.pull', () => {
  afterEach(() => jest.clearAllMocks());

  it('fetches vehicles from the API and reconciles them locally', async () => {
    mockListVehicles.mockResolvedValue([vehicle]);
    mockGetVehicle.mockResolvedValue(vehicleDetail());
    const vehicleRepository = fakeVehicleRepository();
    const service = createSyncService({
      client: fakeClient,
      vehicleRepository,
      logEntryRepository: fakeLogEntryRepository(),
      outboxRepository: fakeOutboxRepository([]),
      handlers: {},
    });

    await service.pull();

    expect(mockListVehicles).toHaveBeenCalledWith(fakeClient);
    expect(vehicleRepository.reconcile).toHaveBeenCalledWith([vehicle]);
  });

  it('fetches each vehicle\'s detail and applies its stats/transferPending fields', async () => {
    mockListVehicles.mockResolvedValue([vehicle]);
    mockGetVehicle.mockResolvedValue(
      vehicleDetail({
        stats: { totalSpent: '1840.00', lastLoggedAt: '2026-06-28' },
        transferPending: true,
        pendingTransfer: { recipientEmail: 'alex@example.com', expiresAt: '2026-07-10' },
      }),
    );
    const vehicleRepository = fakeVehicleRepository();
    const service = createSyncService({
      client: fakeClient,
      vehicleRepository,
      logEntryRepository: fakeLogEntryRepository(),
      outboxRepository: fakeOutboxRepository([]),
      handlers: {},
    });

    await service.pull();

    expect(mockGetVehicle).toHaveBeenCalledWith(fakeClient, 'v1');
    expect(vehicleRepository.applyDetail).toHaveBeenCalledWith('v1', {
      totalSpent: '1840.00',
      lastLoggedAt: '2026-06-28',
      transferPending: true,
      pendingTransferRecipientEmail: 'alex@example.com',
    });
  });

  it('collects log entries from every vehicle and reconciles them in one call', async () => {
    const vehicleB: VehicleSummary = { ...vehicle, id: 'v2' };
    mockListVehicles.mockResolvedValue([vehicle, vehicleB]);
    mockGetVehicle.mockImplementation(async (_client, vehicleId) =>
      vehicleDetail({
        id: vehicleId,
        logEntries: [
          {
            id: `${vehicleId}-e1`,
            typeId: 'MAINTENANCE',
            title: 'Oil change',
            date: '2026-06-28',
            time: null,
            mileage: 4200,
            itemCount: 1,
            mediaCount: 0,
            totalCost: '40.00',
          },
        ],
      }),
    );
    const logEntryRepository = fakeLogEntryRepository();
    const service = createSyncService({
      client: fakeClient,
      vehicleRepository: fakeVehicleRepository(),
      logEntryRepository,
      outboxRepository: fakeOutboxRepository([]),
      handlers: {},
    });

    await service.pull();

    expect(logEntryRepository.reconcile).toHaveBeenCalledTimes(1);
    expect(logEntryRepository.reconcile).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'v1-e1', vehicleId: 'v1' }),
      expect.objectContaining({ id: 'v2-e1', vehicleId: 'v2' }),
    ]);
  });

  it('keeps a vehicle\'s last-known log entries when its detail fetch fails, rather than dropping them', async () => {
    const vehicleB: VehicleSummary = { ...vehicle, id: 'v2' };
    mockListVehicles.mockResolvedValue([vehicle, vehicleB]);
    mockGetVehicle.mockImplementation(async (_client, vehicleId) => {
      if (vehicleId === 'v1') throw new Error('network error');
      return vehicleDetail({
        id: vehicleId,
        logEntries: [
          {
            id: 'v2-e1',
            typeId: 'MAINTENANCE',
            title: 'Oil change',
            date: '2026-06-28',
            time: null,
            mileage: 4200,
            itemCount: 1,
            mediaCount: 0,
            totalCost: '40.00',
          },
        ],
      });
    });
    const logEntryRepository = fakeLogEntryRepository();
    const staleEntry = {
      id: 'v1-e0',
      typeId: 'REPAIR',
      title: 'Brake pads',
      date: '2026-04-02',
      time: null,
      mileage: 4000,
      itemCount: 1,
      mediaCount: 0,
      totalCost: '60.00',
    };
    logEntryRepository.findByVehicleId.mockImplementation(async (vehicleId) =>
      vehicleId === 'v1' ? [staleEntry] : [],
    );
    const vehicleRepository = fakeVehicleRepository();
    const service = createSyncService({
      client: fakeClient,
      vehicleRepository,
      logEntryRepository,
      outboxRepository: fakeOutboxRepository([]),
      handlers: {},
    });

    await service.pull();

    expect(vehicleRepository.applyDetail).not.toHaveBeenCalledWith('v1', expect.anything());
    expect(logEntryRepository.reconcile).toHaveBeenCalledWith([
      { ...staleEntry, vehicleId: 'v1' },
      expect.objectContaining({ id: 'v2-e1', vehicleId: 'v2' }),
    ]);
  });
});

describe('SyncService.flushOutbox', () => {
  afterEach(() => jest.clearAllMocks());

  it('processes pending entries in order and removes each on success', async () => {
    const entries = [entry('b', 200), entry('a', 100)];
    const outboxRepository = fakeOutboxRepository(entries);
    const callOrder: string[] = [];
    const handlers = { CREATE_VEHICLE: jest.fn(async () => void callOrder.push('handled')) };

    const service = createSyncService({
      client: fakeClient,
      vehicleRepository: fakeVehicleRepository(),
      logEntryRepository: fakeLogEntryRepository(),
      outboxRepository,
      handlers,
    });

    await service.flushOutbox();

    // listPending already returns created_at order (a, b) via the fake's
    // filter — the handler must have been invoked once per entry.
    expect(handlers.CREATE_VEHICLE).toHaveBeenCalledTimes(2);
    expect(outboxRepository.remove).toHaveBeenCalledWith('a');
    expect(outboxRepository.remove).toHaveBeenCalledWith('b');
  });

  it('marks an entry failed and continues when no handler is registered for its type', async () => {
    const entries = [entry('a', 100, 'UNKNOWN_TYPE'), entry('b', 200, 'CREATE_VEHICLE')];
    const outboxRepository = fakeOutboxRepository(entries);
    const handlers = { CREATE_VEHICLE: jest.fn(async () => {}) };

    const service = createSyncService({
      client: fakeClient,
      vehicleRepository: fakeVehicleRepository(),
      logEntryRepository: fakeLogEntryRepository(),
      outboxRepository,
      handlers,
    });

    await service.flushOutbox();

    expect(outboxRepository.markStatus).toHaveBeenCalledWith('a', 'failed');
    expect(handlers.CREATE_VEHICLE).toHaveBeenCalledTimes(1);
    expect(outboxRepository.remove).toHaveBeenCalledWith('b');
  });

  it('marks an entry failed and continues on a non-retryable handler error', async () => {
    const entries = [entry('a', 100), entry('b', 200)];
    const outboxRepository = fakeOutboxRepository(entries);
    const handlers = {
      CREATE_VEHICLE: jest
        .fn()
        .mockRejectedValueOnce(new Error('validation failed'))
        .mockResolvedValueOnce(undefined),
    };

    const service = createSyncService({
      client: fakeClient,
      vehicleRepository: fakeVehicleRepository(),
      logEntryRepository: fakeLogEntryRepository(),
      outboxRepository,
      handlers,
    });

    await service.flushOutbox();

    expect(outboxRepository.markStatus).toHaveBeenCalledWith('a', 'failed');
    expect(outboxRepository.remove).toHaveBeenCalledWith('b');
    expect(outboxRepository.remove).not.toHaveBeenCalledWith('a');
  });

  it('stops the entire flush and reverts to pending on a retryable handler error', async () => {
    const entries = [entry('a', 100), entry('b', 200), entry('c', 300)];
    const outboxRepository = fakeOutboxRepository(entries);
    const handlers = {
      CREATE_VEHICLE: jest.fn().mockRejectedValueOnce(new RetryableOutboxError('network error')),
    };

    const service = createSyncService({
      client: fakeClient,
      vehicleRepository: fakeVehicleRepository(),
      logEntryRepository: fakeLogEntryRepository(),
      outboxRepository,
      handlers,
    });

    await service.flushOutbox();

    expect(handlers.CREATE_VEHICLE).toHaveBeenCalledTimes(1);
    expect(outboxRepository.markStatus).toHaveBeenCalledWith('a', 'pending');
    expect(outboxRepository.remove).not.toHaveBeenCalled();
  });
});

describe('SyncService.runFullSync', () => {
  afterEach(() => jest.clearAllMocks());

  it('flushes the outbox before pulling', async () => {
    mockListVehicles.mockResolvedValue([]);
    const callOrder: string[] = [];
    const vehicleRepository = fakeVehicleRepository();
    vehicleRepository.reconcile.mockImplementation(async () => void callOrder.push('pull'));
    const outboxRepository = fakeOutboxRepository([entry('a', 100)]);
    const handlers = { CREATE_VEHICLE: jest.fn(async () => void callOrder.push('flush')) };

    const service = createSyncService({
      client: fakeClient,
      vehicleRepository,
      logEntryRepository: fakeLogEntryRepository(),
      outboxRepository,
      handlers,
    });

    await service.runFullSync();

    expect(callOrder).toEqual(['flush', 'pull']);
  });
});
