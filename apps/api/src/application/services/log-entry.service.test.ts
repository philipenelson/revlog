import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogEntryService } from './log-entry.service';
import { AppError } from '../../adapters/http/middleware/error';
import type { CreateLogEntryInput } from '@maintenance-log/contracts';
import type { LogEntryRepository, VehicleRepository, MetadataRepository, LogEntry, LogEntrySummary, Vehicle } from '../../domain';

const fixedNow = new Date('2026-01-01T00:00:00Z');

const mockVehicle: Vehicle = {
  id: 'vehicle-1',
  accountId: 'account-1',
  nickname: 'My Bike',
  make: 'Honda',
  model: 'CB500F',
  year: 2021,
  mileage: 14000,
  photoPath: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const mockEntry: LogEntry = {
  id: 'entry-1',
  vehicleId: 'vehicle-1',
  typeId: 'MAINTENANCE',
  title: 'Oil change',
  date: '2026-01-15',
  time: null,
  mileage: 15000,
  notes: null,
  items: [],
  media: [],
  totalCost: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const mockSummary: LogEntrySummary = {
  id: 'entry-1',
  typeId: 'MAINTENANCE',
  title: 'Oil change',
  date: '2026-01-15',
  time: null,
  mileage: 15000,
  itemCount: 0,
  mediaCount: 0,
  totalCost: null,
};

const validInput: CreateLogEntryInput = {
  typeId: 'MAINTENANCE',
  title: 'Oil change',
  date: '2026-01-15',
  notes: null,
  items: [],
  media: [],
};

function makeFakeLogEntryRepo(overrides: Partial<LogEntryRepository> = {}): LogEntryRepository {
  return {
    create: vi.fn().mockResolvedValue(mockEntry),
    findAllByVehicleId: vi.fn().mockResolvedValue([mockSummary]),
    findById: vi.fn().mockResolvedValue(mockEntry),
    update: vi.fn().mockResolvedValue(mockEntry),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeFakeVehicleRepo(overrides: Partial<VehicleRepository> = {}): VehicleRepository {
  return {
    create: vi.fn(),
    findAllByAccountId: vi.fn().mockResolvedValue([mockVehicle]),
    setPhoto: vi.fn(),
    findDetailById: vi.fn().mockResolvedValue(null),
    update: vi.fn(),
    delete: vi.fn(),
    existsById: vi.fn().mockResolvedValue(true),
    bumpMileageIfLower: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeFakeMetadataRepo(overrides: Partial<MetadataRepository> = {}): MetadataRepository {
  return {
    logEntryTypeExists: vi.fn().mockResolvedValue(true),
    itemCategoryExists: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('LogEntryService.create', () => {
  let logEntryRepo: LogEntryRepository;
  let vehicleRepo: VehicleRepository;
  let metadataRepo: MetadataRepository;
  let service: LogEntryService;

  beforeEach(() => {
    vi.clearAllMocks();
    logEntryRepo = makeFakeLogEntryRepo();
    vehicleRepo = makeFakeVehicleRepo();
    metadataRepo = makeFakeMetadataRepo();
    service = new LogEntryService(logEntryRepo, vehicleRepo, metadataRepo);
  });

  it('creates entry for owned vehicle', async () => {
    const result = await service.create('vehicle-1', 'account-1', validInput);

    expect(logEntryRepo.create).toHaveBeenCalledOnce();
    expect(result).toEqual(mockEntry);
  });

  it('updates vehicle mileage when entry mileage is higher', async () => {
    await service.create('vehicle-1', 'account-1', { ...validInput, mileage: 15000 });

    expect(vehicleRepo.bumpMileageIfLower).toHaveBeenCalledWith('vehicle-1', 15000);
  });

  it('does not update vehicle mileage when entry has no mileage', async () => {
    await service.create('vehicle-1', 'account-1', { ...validInput, mileage: null });

    expect(vehicleRepo.bumpMileageIfLower).not.toHaveBeenCalled();
  });

  it('throws AppError(400) for invalid typeId', async () => {
    (metadataRepo.logEntryTypeExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await expect(service.create('vehicle-1', 'account-1', validInput)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws AppError(404) when vehicle does not exist', async () => {
    (vehicleRepo.findAllByAccountId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (vehicleRepo.existsById as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await expect(service.create('vehicle-1', 'account-1', validInput)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws AppError(403) when vehicle belongs to another account', async () => {
    (vehicleRepo.findAllByAccountId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (vehicleRepo.existsById as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await expect(service.create('vehicle-1', 'account-1', validInput)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('LogEntryService.list', () => {
  let logEntryRepo: LogEntryRepository;
  let vehicleRepo: VehicleRepository;
  let metadataRepo: MetadataRepository;
  let service: LogEntryService;

  beforeEach(() => {
    vi.clearAllMocks();
    logEntryRepo = makeFakeLogEntryRepo();
    vehicleRepo = makeFakeVehicleRepo();
    metadataRepo = makeFakeMetadataRepo();
    service = new LogEntryService(logEntryRepo, vehicleRepo, metadataRepo);
  });

  it('returns list sorted by date desc', async () => {
    const result = await service.list('vehicle-1', 'account-1');

    expect(logEntryRepo.findAllByVehicleId).toHaveBeenCalledWith('vehicle-1', undefined);
    expect(result).toEqual([mockSummary]);
  });

  it('passes typeId filter to repository', async () => {
    await service.list('vehicle-1', 'account-1', 'MAINTENANCE');

    expect(logEntryRepo.findAllByVehicleId).toHaveBeenCalledWith('vehicle-1', 'MAINTENANCE');
  });
});

describe('LogEntryService.delete', () => {
  let logEntryRepo: LogEntryRepository;
  let vehicleRepo: VehicleRepository;
  let metadataRepo: MetadataRepository;
  let service: LogEntryService;

  beforeEach(() => {
    vi.clearAllMocks();
    logEntryRepo = makeFakeLogEntryRepo();
    vehicleRepo = makeFakeVehicleRepo();
    metadataRepo = makeFakeMetadataRepo();
    service = new LogEntryService(logEntryRepo, vehicleRepo, metadataRepo);
  });

  it('deletes an existing entry successfully', async () => {
    await expect(service.delete('vehicle-1', 'account-1', 'entry-1')).resolves.toBeUndefined();
    expect(logEntryRepo.delete).toHaveBeenCalledWith('vehicle-1', 'entry-1');
  });

  it('throws AppError(404) when entry not found', async () => {
    (logEntryRepo.delete as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await expect(service.delete('vehicle-1', 'account-1', 'missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
