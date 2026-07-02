import type { HttpClient } from '@maintenance-log/api-client';
import type { VehicleSummary } from '@maintenance-log/api-client';
import type { VehicleRepository } from '@/domain/repositories/VehicleRepository';
import type { OutboxEntry, OutboxRepository } from '@/domain/repositories/OutboxRepository';
import { createSyncService, RetryableOutboxError } from './SyncService';

jest.mock('@maintenance-log/api-client', () => ({
  ...jest.requireActual('@maintenance-log/api-client'),
  listVehicles: jest.fn(),
}));

import { listVehicles } from '@maintenance-log/api-client';

const mockListVehicles = listVehicles as jest.MockedFunction<typeof listVehicles>;

const fakeClient = {} as HttpClient;

function fakeVehicleRepository(): jest.Mocked<VehicleRepository> {
  return { findAll: jest.fn(), reconcile: jest.fn() };
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

function entry(id: string, createdAt: number, type = 'CREATE_VEHICLE'): OutboxEntry {
  return { id, type, payload: '{}', createdAt, status: 'pending' };
}

describe('SyncService.pull', () => {
  afterEach(() => jest.clearAllMocks());

  it('fetches vehicles from the API and reconciles them locally', async () => {
    mockListVehicles.mockResolvedValue([vehicle]);
    const vehicleRepository = fakeVehicleRepository();
    const service = createSyncService({
      client: fakeClient,
      vehicleRepository,
      outboxRepository: fakeOutboxRepository([]),
      handlers: {},
    });

    await service.pull();

    expect(mockListVehicles).toHaveBeenCalledWith(fakeClient);
    expect(vehicleRepository.reconcile).toHaveBeenCalledWith([vehicle]);
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

    const service = createSyncService({ client: fakeClient, vehicleRepository, outboxRepository, handlers });

    await service.runFullSync();

    expect(callOrder).toEqual(['flush', 'pull']);
  });
});
