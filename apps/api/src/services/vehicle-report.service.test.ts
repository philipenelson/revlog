import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VehicleReportService } from './vehicle-report.service';
import type {
  IVehicleReportTokenRepository,
  IVehicleRepository,
  DomainVehicleReportToken,
  DomainVehicleDetail,
  MechanicPrintout,
} from '@maintenance-log/domain';
import type { VehicleReportEmailer } from './vehicle-report.service';

const fixedNow = new Date('2026-01-01T00:00:00Z');

const mockToken: DomainVehicleReportToken = {
  id: 'token-id-1',
  vehicleId: 'vehicle-1',
  token: 'share-token-abc',
  createdAt: fixedNow,
};

const mockVehicleDetail: DomainVehicleDetail = {
  id: 'vehicle-1',
  accountId: 'account-1',
  nickname: 'Blackbird',
  make: 'Honda',
  model: 'CB650R',
  year: 2019,
  mileage: 12400,
  photoPath: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
  insurance: null,
  logEntries: [],
  stats: { totalSpent: '0.00', lastLoggedAt: null },
};

const mockPrintout: MechanicPrintout = {
  vehicle: { nickname: 'Blackbird', make: 'Honda', model: 'CB650R', year: 2019, mileage: 12400, photoUrl: null },
  stats: { logEntryCount: 0, lastLoggedAt: null, totalSpent: '0.00' },
  logEntries: [],
};

function makeFakeTokenRepo(overrides: Partial<IVehicleReportTokenRepository> = {}): IVehicleReportTokenRepository {
  return {
    upsertByVehicleId: vi.fn().mockResolvedValue(mockToken),
    deleteByVehicleId: vi.fn().mockResolvedValue(true),
    findByToken: vi.fn().mockResolvedValue(mockToken),
    findByVehicleId: vi.fn().mockResolvedValue(mockToken),
    findPrintoutByToken: vi.fn().mockResolvedValue(mockPrintout),
    ...overrides,
  };
}

function makeFakeVehicleRepo(overrides: Partial<IVehicleRepository> = {}): IVehicleRepository {
  return {
    create: vi.fn(),
    findAllByAccountId: vi.fn(),
    setPhoto: vi.fn(),
    findDetailById: vi.fn().mockResolvedValue(mockVehicleDetail),
    update: vi.fn(),
    ...overrides,
  } as unknown as IVehicleRepository;
}

function makeFakeEmailer(): VehicleReportEmailer {
  return { sendMechanicPrintoutEmail: vi.fn().mockResolvedValue(undefined) };
}

const APP_URL = 'https://app.revlog.io';

describe('VehicleReportService.createToken', () => {
  let tokenRepo: IVehicleReportTokenRepository;
  let vehicleRepo: IVehicleRepository;
  let emailer: VehicleReportEmailer;
  let service: VehicleReportService;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenRepo = makeFakeTokenRepo();
    vehicleRepo = makeFakeVehicleRepo();
    emailer = makeFakeEmailer();
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);
  });

  it('creates a token and returns the share URL', async () => {
    const result = await service.createToken('vehicle-1', 'account-1');

    expect(tokenRepo.upsertByVehicleId).toHaveBeenCalledWith('vehicle-1');
    expect(result.shareToken).toBe('share-token-abc');
    expect(result.shareUrl).toBe(`${APP_URL}/report/share-token-abc`);
  });

  it('throws 404 when vehicle does not exist', async () => {
    vehicleRepo = makeFakeVehicleRepo({ findDetailById: vi.fn().mockResolvedValue(null) });
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);

    await expect(service.createToken('vehicle-1', 'account-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when vehicle belongs to a different account', async () => {
    vehicleRepo = makeFakeVehicleRepo({
      findDetailById: vi.fn().mockResolvedValue({ ...mockVehicleDetail, accountId: 'other' }),
    });
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);

    await expect(service.createToken('vehicle-1', 'account-1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('calling createToken twice replaces the old token (upsert is called each time)', async () => {
    await service.createToken('vehicle-1', 'account-1');
    await service.createToken('vehicle-1', 'account-1');

    expect(tokenRepo.upsertByVehicleId).toHaveBeenCalledTimes(2);
  });
});

describe('VehicleReportService.revokeToken', () => {
  let tokenRepo: IVehicleReportTokenRepository;
  let vehicleRepo: IVehicleRepository;
  let emailer: VehicleReportEmailer;
  let service: VehicleReportService;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenRepo = makeFakeTokenRepo();
    vehicleRepo = makeFakeVehicleRepo();
    emailer = makeFakeEmailer();
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);
  });

  it('deletes the token for the given vehicle', async () => {
    await service.revokeToken('vehicle-1', 'account-1');

    expect(tokenRepo.deleteByVehicleId).toHaveBeenCalledWith('vehicle-1');
  });

  it('throws 404 when no token exists to revoke', async () => {
    tokenRepo = makeFakeTokenRepo({ deleteByVehicleId: vi.fn().mockResolvedValue(false) });
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);

    await expect(service.revokeToken('vehicle-1', 'account-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when vehicle does not exist', async () => {
    vehicleRepo = makeFakeVehicleRepo({ findDetailById: vi.fn().mockResolvedValue(null) });
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);

    await expect(service.revokeToken('vehicle-1', 'account-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when vehicle belongs to a different account', async () => {
    vehicleRepo = makeFakeVehicleRepo({
      findDetailById: vi.fn().mockResolvedValue({ ...mockVehicleDetail, accountId: 'other' }),
    });
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);

    await expect(service.revokeToken('vehicle-1', 'account-1')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('VehicleReportService.emailLink', () => {
  let tokenRepo: IVehicleReportTokenRepository;
  let vehicleRepo: IVehicleRepository;
  let emailer: VehicleReportEmailer;
  let service: VehicleReportService;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenRepo = makeFakeTokenRepo();
    vehicleRepo = makeFakeVehicleRepo();
    emailer = makeFakeEmailer();
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);
  });

  it('sends an email with the correct report URL', async () => {
    await service.emailLink('vehicle-1', 'account-1', 'mechanic@shop.com');

    expect(emailer.sendMechanicPrintoutEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(emailer.sendMechanicPrintoutEmail).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.to).toBe('mechanic@shop.com');
    expect(call?.reportUrl).toBe(`${APP_URL}/report/share-token-abc`);
  });

  it('throws 404 when no active token exists', async () => {
    tokenRepo = makeFakeTokenRepo({ findByVehicleId: vi.fn().mockResolvedValue(null) });
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);

    await expect(service.emailLink('vehicle-1', 'account-1', 'x@x.com')).rejects.toMatchObject({ statusCode: 404 });
    expect(emailer.sendMechanicPrintoutEmail).not.toHaveBeenCalled();
  });

  it('throws 403 when vehicle belongs to a different account', async () => {
    vehicleRepo = makeFakeVehicleRepo({
      findDetailById: vi.fn().mockResolvedValue({ ...mockVehicleDetail, accountId: 'other' }),
    });
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);

    await expect(service.emailLink('vehicle-1', 'account-1', 'x@x.com')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('VehicleReportService.getByShareToken', () => {
  let tokenRepo: IVehicleReportTokenRepository;
  let vehicleRepo: IVehicleRepository;
  let emailer: VehicleReportEmailer;
  let service: VehicleReportService;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenRepo = makeFakeTokenRepo();
    vehicleRepo = makeFakeVehicleRepo();
    emailer = makeFakeEmailer();
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);
  });

  it('returns the printout for a valid token', async () => {
    const result = await service.getByShareToken('share-token-abc');

    expect(tokenRepo.findPrintoutByToken).toHaveBeenCalledWith('share-token-abc');
    expect(result).toEqual(mockPrintout);
  });

  it('returns null for an unknown or revoked token', async () => {
    tokenRepo = makeFakeTokenRepo({ findPrintoutByToken: vi.fn().mockResolvedValue(null) });
    service = new VehicleReportService(tokenRepo, vehicleRepo, emailer, APP_URL);

    const result = await service.getByShareToken('bad-token');

    expect(result).toBeNull();
  });
});

describe('VehicleReportService.getActiveToken', () => {
  it('returns null when no active token exists', async () => {
    const tokenRepo = makeFakeTokenRepo({ findByVehicleId: vi.fn().mockResolvedValue(null) });
    const vehicleRepo = makeFakeVehicleRepo();
    const service = new VehicleReportService(tokenRepo, vehicleRepo, makeFakeEmailer(), APP_URL);

    const result = await service.getActiveToken('vehicle-1', 'account-1');

    expect(result).toBeNull();
  });

  it('returns the token and URL when an active token exists', async () => {
    const tokenRepo = makeFakeTokenRepo();
    const vehicleRepo = makeFakeVehicleRepo();
    const service = new VehicleReportService(tokenRepo, vehicleRepo, makeFakeEmailer(), APP_URL);

    const result = await service.getActiveToken('vehicle-1', 'account-1');

    expect(result).toEqual({
      shareToken: 'share-token-abc',
      shareUrl: `${APP_URL}/report/share-token-abc`,
    });
  });
});
