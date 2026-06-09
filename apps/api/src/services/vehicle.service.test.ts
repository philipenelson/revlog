import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VehicleService } from './vehicle.service';
import { AppError } from '../middleware/error';
import type { IVehicleRepository, IAccountRepository, DomainVehicle, DomainVehicleDetail, DomainAccount, CreateVehicleInput } from '@maintenance-log/domain';

const fixedNow = new Date('2026-01-01T00:00:00Z');

const mockAccount: DomainAccount = {
  id: 'account-1',
  type: 'PERSONAL',
  status: 'ONBOARDING',
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const mockVehicle: DomainVehicle = {
  id: 'vehicle-1',
  accountId: 'account-1',
  nickname: 'Daily ride',
  make: 'Honda',
  model: 'CB500F',
  year: 2021,
  mileage: 14230,
  photoPath: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const validInput: CreateVehicleInput = {
  nickname: 'Daily ride',
  make: 'Honda',
  model: 'CB500F',
  year: 2021,
  mileage: 14230,
};

const mockVehicleDetail: DomainVehicleDetail = {
  id: 'vehicle-1',
  accountId: 'account-1',
  nickname: 'Daily ride',
  make: 'Honda',
  model: 'CB500F',
  year: 2021,
  mileage: 14230,
  photoPath: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
  insurance: null,
  logEntries: [],
  stats: { totalSpent: '0.00', lastLoggedAt: null },
};

function makeFakeVehicleRepo(overrides: Partial<IVehicleRepository> = {}): IVehicleRepository {
  return {
    create: vi.fn().mockResolvedValue(mockVehicle),
    findAllByAccountId: vi.fn().mockResolvedValue([mockVehicle]),
    setPhoto: vi.fn().mockResolvedValue({ ...mockVehicle, photoPath: 'new.jpg' }),
    findDetailById: vi.fn().mockResolvedValue(mockVehicleDetail),
    ...overrides,
  };
}

function makeFakeAccountRepo(overrides: Partial<IAccountRepository> = {}): IAccountRepository {
  return {
    create: vi.fn().mockResolvedValue(mockAccount),
    findById: vi.fn().mockResolvedValue(mockAccount),
    markActive: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('VehicleService.createVehicle', () => {
  let vehicleRepo: IVehicleRepository;
  let accountRepo: IAccountRepository;
  let service: VehicleService;

  beforeEach(() => {
    vi.clearAllMocks();
    vehicleRepo = makeFakeVehicleRepo();
    accountRepo = makeFakeAccountRepo();
    service = new VehicleService(vehicleRepo, accountRepo);
  });

  it('creates the vehicle scoped to the given accountId with photoPath null by default', async () => {
    await service.createVehicle('account-1', validInput);

    expect(vehicleRepo.create).toHaveBeenCalledOnce();
    expect(vehicleRepo.create).toHaveBeenCalledWith({ accountId: 'account-1', ...validInput, photoPath: null });
  });

  it('passes the photoPath to the repository when provided', async () => {
    await service.createVehicle('account-1', validInput, 'photo.jpg');

    expect(vehicleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ photoPath: 'photo.jpg' }),
    );
  });

  it('transitions the account out of onboarding after creating the vehicle', async () => {
    await service.createVehicle('account-1', validInput);

    expect(accountRepo.markActive).toHaveBeenCalledOnce();
    expect(accountRepo.markActive).toHaveBeenCalledWith('account-1');
  });

  it('returns the created vehicle', async () => {
    const result = await service.createVehicle('account-1', validInput);

    expect(result).toEqual(mockVehicle);
  });
});

describe('VehicleService.listVehicles', () => {
  let vehicleRepo: IVehicleRepository;
  let accountRepo: IAccountRepository;
  let service: VehicleService;

  beforeEach(() => {
    vi.clearAllMocks();
    vehicleRepo = makeFakeVehicleRepo();
    accountRepo = makeFakeAccountRepo();
    service = new VehicleService(vehicleRepo, accountRepo);
  });

  it('lists vehicles scoped to the given accountId', async () => {
    await service.listVehicles('account-1');

    expect(vehicleRepo.findAllByAccountId).toHaveBeenCalledOnce();
    expect(vehicleRepo.findAllByAccountId).toHaveBeenCalledWith('account-1');
  });

  it('returns the vehicles from the repository', async () => {
    const result = await service.listVehicles('account-1');

    expect(result).toEqual([mockVehicle]);
  });

  it('returns an empty array for an account with no vehicles', async () => {
    vehicleRepo = makeFakeVehicleRepo({ findAllByAccountId: vi.fn().mockResolvedValue([]) });
    service = new VehicleService(vehicleRepo, accountRepo);

    const result = await service.listVehicles('account-1');

    expect(result).toEqual([]);
  });

  it('does not touch account status', async () => {
    await service.listVehicles('account-1');

    expect(accountRepo.markActive).not.toHaveBeenCalled();
  });
});

describe('VehicleService.setVehiclePhoto', () => {
  let vehicleRepo: IVehicleRepository;
  let accountRepo: IAccountRepository;
  let service: VehicleService;

  beforeEach(() => {
    vi.clearAllMocks();
    vehicleRepo = makeFakeVehicleRepo();
    accountRepo = makeFakeAccountRepo();
    service = new VehicleService(vehicleRepo, accountRepo);
  });

  it('calls vehicleRepo.setPhoto with vehicleId, accountId, and photoPath', async () => {
    await service.setVehiclePhoto('vehicle-1', 'account-1', 'photo.jpg');

    expect(vehicleRepo.setPhoto).toHaveBeenCalledWith('vehicle-1', 'account-1', 'photo.jpg');
  });

  it('returns the updated vehicle', async () => {
    const result = await service.setVehiclePhoto('vehicle-1', 'account-1', 'photo.jpg');

    expect(result.photoPath).toBe('new.jpg');
  });

  it('throws a 404 AppError when the vehicle is not found or belongs to another account', async () => {
    vehicleRepo = makeFakeVehicleRepo({ setPhoto: vi.fn().mockResolvedValue(null) });
    service = new VehicleService(vehicleRepo, accountRepo);

    await expect(service.setVehiclePhoto('vehicle-1', 'account-1', 'photo.jpg')).rejects.toThrow(AppError);
    await expect(service.setVehiclePhoto('vehicle-1', 'account-1', 'photo.jpg')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('VehicleService.getDetail', () => {
  let vehicleRepo: IVehicleRepository;
  let accountRepo: IAccountRepository;
  let service: VehicleService;

  beforeEach(() => {
    vi.clearAllMocks();
    vehicleRepo = makeFakeVehicleRepo();
    accountRepo = makeFakeAccountRepo();
    service = new VehicleService(vehicleRepo, accountRepo);
  });

  it('calls findDetailById with the given vehicleId', async () => {
    await service.getDetail('vehicle-1', 'account-1');

    expect(vehicleRepo.findDetailById).toHaveBeenCalledOnce();
    expect(vehicleRepo.findDetailById).toHaveBeenCalledWith('vehicle-1');
  });

  it('throws a 404 AppError when the vehicle does not exist', async () => {
    vehicleRepo = makeFakeVehicleRepo({ findDetailById: vi.fn().mockResolvedValue(null) });
    service = new VehicleService(vehicleRepo, accountRepo);

    await expect(service.getDetail('vehicle-1', 'account-1')).rejects.toThrow(AppError);
    await expect(service.getDetail('vehicle-1', 'account-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws a 403 AppError when the vehicle belongs to a different account', async () => {
    vehicleRepo = makeFakeVehicleRepo({
      findDetailById: vi.fn().mockResolvedValue({ ...mockVehicleDetail, accountId: 'other-account' }),
    });
    service = new VehicleService(vehicleRepo, accountRepo);

    await expect(service.getDetail('vehicle-1', 'account-1')).rejects.toThrow(AppError);
    await expect(service.getDetail('vehicle-1', 'account-1')).rejects.toMatchObject({ statusCode: 403 });
  });
});
