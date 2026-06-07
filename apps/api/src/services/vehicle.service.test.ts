import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VehicleService } from './vehicle.service';
import type { IVehicleRepository, IAccountRepository, DomainVehicle, DomainAccount, CreateVehicleInput } from '@maintenance-log/domain';

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

function makeFakeVehicleRepo(overrides: Partial<IVehicleRepository> = {}): IVehicleRepository {
  return {
    create: vi.fn().mockResolvedValue(mockVehicle),
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

  it('creates the vehicle scoped to the given accountId', async () => {
    await service.createVehicle('account-1', validInput);

    expect(vehicleRepo.create).toHaveBeenCalledOnce();
    expect(vehicleRepo.create).toHaveBeenCalledWith({ accountId: 'account-1', ...validInput });
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
