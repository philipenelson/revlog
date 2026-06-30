import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogEntryService } from './log-entry.service';
import { AppError } from '../middleware/error';
import type { ILogEntryRepository, IVehicleRepository, DomainLogEntry, LogEntrySummary, DomainVehicle, CreateLogEntryInput } from '@maintenance-log/domain';
import type { PrismaClient } from '../generated/prisma/client';

const fixedNow = new Date('2026-01-01T00:00:00Z');

const mockVehicle: DomainVehicle = {
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

const mockEntry: DomainLogEntry = {
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

function makeFakeLogEntryRepo(overrides: Partial<ILogEntryRepository> = {}): ILogEntryRepository {
  return {
    create: vi.fn().mockResolvedValue(mockEntry),
    findAllByVehicleId: vi.fn().mockResolvedValue([mockSummary]),
    findById: vi.fn().mockResolvedValue(mockEntry),
    update: vi.fn().mockResolvedValue(mockEntry),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeFakeVehicleRepo(overrides: Partial<IVehicleRepository> = {}): IVehicleRepository {
  return {
    create: vi.fn(),
    findAllByAccountId: vi.fn().mockResolvedValue([mockVehicle]),
    setPhoto: vi.fn(),
    findDetailById: vi.fn().mockResolvedValue(null),
    update: vi.fn(),
    ...overrides,
  };
}

function makeFakeDb(overrides: Record<string, unknown> = {}): Pick<PrismaClient, 'vehicle' | 'logEntryType' | 'itemCategory'> {
  return {
    vehicle: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue(mockVehicle),
    } as unknown as PrismaClient['vehicle'],
    logEntryType: {
      findUnique: vi.fn().mockResolvedValue({ id: 'MAINTENANCE' }),
    } as unknown as PrismaClient['logEntryType'],
    itemCategory: {
      findUnique: vi.fn().mockResolvedValue({ id: 'PART' }),
    } as unknown as PrismaClient['itemCategory'],
    ...overrides,
  };
}

describe('LogEntryService.create', () => {
  let logEntryRepo: ILogEntryRepository;
  let vehicleRepo: IVehicleRepository;
  let db: ReturnType<typeof makeFakeDb>;
  let service: LogEntryService;

  beforeEach(() => {
    vi.clearAllMocks();
    logEntryRepo = makeFakeLogEntryRepo();
    vehicleRepo = makeFakeVehicleRepo();
    db = makeFakeDb();
    service = new LogEntryService(logEntryRepo, vehicleRepo, db as Pick<PrismaClient, 'vehicle' | 'logEntryType' | 'itemCategory'>);
  });

  it('creates entry for owned vehicle', async () => {
    const result = await service.create('vehicle-1', 'account-1', validInput);

    expect(logEntryRepo.create).toHaveBeenCalledOnce();
    expect(result).toEqual(mockEntry);
  });

  it('updates vehicle mileage when entry mileage is higher', async () => {
    await service.create('vehicle-1', 'account-1', { ...validInput, mileage: 15000 });

    expect(db.vehicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'vehicle-1', mileage: { lt: 15000 } },
      data: { mileage: 15000 },
    });
  });

  it('does not update vehicle mileage when entry has no mileage', async () => {
    await service.create('vehicle-1', 'account-1', { ...validInput, mileage: null });

    expect(db.vehicle.updateMany).not.toHaveBeenCalled();
  });

  it('throws AppError(400) for invalid typeId', async () => {
    (db.logEntryType.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(service.create('vehicle-1', 'account-1', validInput)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws AppError(404) when vehicle does not exist', async () => {
    (vehicleRepo.findAllByAccountId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.vehicle.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(service.create('vehicle-1', 'account-1', validInput)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws AppError(403) when vehicle belongs to another account', async () => {
    (vehicleRepo.findAllByAccountId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.vehicle.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'vehicle-1' });

    await expect(service.create('vehicle-1', 'account-1', validInput)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('LogEntryService.list', () => {
  let logEntryRepo: ILogEntryRepository;
  let vehicleRepo: IVehicleRepository;
  let db: ReturnType<typeof makeFakeDb>;
  let service: LogEntryService;

  beforeEach(() => {
    vi.clearAllMocks();
    logEntryRepo = makeFakeLogEntryRepo();
    vehicleRepo = makeFakeVehicleRepo();
    db = makeFakeDb();
    service = new LogEntryService(logEntryRepo, vehicleRepo, db as Pick<PrismaClient, 'vehicle' | 'logEntryType' | 'itemCategory'>);
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
  let logEntryRepo: ILogEntryRepository;
  let vehicleRepo: IVehicleRepository;
  let db: ReturnType<typeof makeFakeDb>;
  let service: LogEntryService;

  beforeEach(() => {
    vi.clearAllMocks();
    logEntryRepo = makeFakeLogEntryRepo();
    vehicleRepo = makeFakeVehicleRepo();
    db = makeFakeDb();
    service = new LogEntryService(logEntryRepo, vehicleRepo, db as Pick<PrismaClient, 'vehicle' | 'logEntryType' | 'itemCategory'>);
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
