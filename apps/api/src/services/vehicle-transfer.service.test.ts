import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VehicleTransferService } from './vehicle-transfer.service';
import { AppError } from '../middleware/error';
import type { VehicleTransferRepository, VehicleRepository, UserRepository, VehicleTransfer, VehicleDetail, User } from '../domain';
import type { EmailSender } from '../application/ports/EmailSender';

const fixedNow = new Date('2026-01-01T00:00:00Z');
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const pastDate = new Date(Date.now() - 1000);

const mockSenderUser: User = {
  id: 'user-1',
  accountId: 'account-1',
  fullName: 'Alex Morgan',
  email: 'alex@example.com',
  passwordHash: 'hash',
  role: 'OWNER',
  emailVerified: true,
  verificationCodeHash: null,
  verificationCodeExpiresAt: null,
  verificationAttemptsRemaining: null,
  passwordResetCodeHash: null,
  passwordResetCodeExpiresAt: null,
  passwordResetAttemptsRemaining: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const mockRecipientUser: User = {
  id: 'user-2',
  accountId: 'account-2',
  fullName: 'Jordan Lee',
  email: 'jordan@example.com',
  passwordHash: 'hash',
  role: 'OWNER',
  emailVerified: true,
  verificationCodeHash: null,
  verificationCodeExpiresAt: null,
  verificationAttemptsRemaining: null,
  passwordResetCodeHash: null,
  passwordResetCodeExpiresAt: null,
  passwordResetAttemptsRemaining: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const mockVehicleDetail: VehicleDetail = {
  id: 'vehicle-1',
  accountId: 'account-1',
  nickname: 'Blackbird',
  make: 'Honda',
  model: 'CB650R',
  year: 2019,
  mileage: 12000,
  photoPath: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
  insurance: null,
  logEntries: Array.from({ length: 14 }, (_, i) => ({
    id: `entry-${i}`,
    typeId: 'MAINTENANCE',
    title: `Entry ${i}`,
    date: '2026-01-01',
    time: null,
    mileage: null,
    itemCount: 0,
    mediaCount: 0,
    totalCost: null,
  })),
  stats: { totalSpent: '0.00', lastLoggedAt: null },
  transferPending: false,
  pendingTransfer: null,
};

const mockTransfer: VehicleTransfer = {
  id: 'transfer-1',
  vehicleId: 'vehicle-1',
  senderAccountId: 'account-1',
  recipientEmail: 'jordan@example.com',
  recipientAccountId: 'account-2',
  token: 'token-abc',
  status: 'PENDING',
  expiresAt: futureDate,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

function makeFakeTransferRepo(overrides: Partial<VehicleTransferRepository> = {}): VehicleTransferRepository {
  return {
    create: vi.fn().mockResolvedValue(mockTransfer),
    findByToken: vi.fn().mockResolvedValue(mockTransfer),
    findPendingByVehicleId: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockImplementation((id, status) => Promise.resolve({ ...mockTransfer, id, status })),
    transferVehicle: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeFakeVehicleRepo(overrides: Partial<VehicleRepository> = {}): VehicleRepository {
  return {
    create: vi.fn(),
    findAllByAccountId: vi.fn().mockResolvedValue([]),
    setPhoto: vi.fn(),
    findDetailById: vi.fn().mockResolvedValue(mockVehicleDetail),
    update: vi.fn(),
    ...overrides,
  };
}

function makeFakeUserRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(id === 'user-1' ? mockSenderUser : id === 'user-2' ? mockRecipientUser : null),
    ),
    findByAccountId: vi.fn().mockImplementation((accountId: string) =>
      Promise.resolve(accountId === 'account-1' ? mockSenderUser : accountId === 'account-2' ? mockRecipientUser : null),
    ),
    findByEmail: vi.fn().mockImplementation((email: string) =>
      Promise.resolve(email === 'jordan@example.com' ? mockRecipientUser : null),
    ),
    create: vi.fn(),
    setVerificationCode: vi.fn(),
    decrementVerificationAttempt: vi.fn(),
    clearVerificationCode: vi.fn(),
    markVerified: vi.fn(),
    setPasswordResetCode: vi.fn(),
    decrementPasswordResetAttempt: vi.fn(),
    clearPasswordResetCode: vi.fn(),
    resetPassword: vi.fn(),
    createWithAccount: vi.fn(),
    ...overrides,
  };
}

function makeFakeEmail(): EmailSender {
  return {
    sendTransferNotification: vi.fn().mockResolvedValue(undefined),
    sendTransferInvitation: vi.fn().mockResolvedValue(undefined),
    sendTransferCancellation: vi.fn().mockResolvedValue(undefined),
    sendTransferDecline: vi.fn().mockResolvedValue(undefined),
    sendTransferExpiry: vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailSender;
}

const APP_URL = 'http://localhost:3000';

// ── initiate ──────────────────────────────────────────────────────────────

describe('VehicleTransferService.initiate', () => {
  let transferRepo: VehicleTransferRepository;
  let vehicleRepo: VehicleRepository;
  let userRepo: UserRepository;
  let email: EmailSender;
  let service: VehicleTransferService;

  beforeEach(() => {
    vi.clearAllMocks();
    transferRepo = makeFakeTransferRepo();
    vehicleRepo = makeFakeVehicleRepo();
    userRepo = makeFakeUserRepo();
    email = makeFakeEmail();
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);
  });

  it('creates a transfer record with PENDING status', async () => {
    await service.initiate('vehicle-1', 'account-1', 'user-1', 'jordan@example.com');

    expect(transferRepo.create).toHaveBeenCalledOnce();
    expect(transferRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: 'vehicle-1', senderAccountId: 'account-1', recipientEmail: 'jordan@example.com' }),
    );
  });

  it('sends a notification email to an existing recipient', async () => {
    await service.initiate('vehicle-1', 'account-1', 'user-1', 'jordan@example.com');

    expect(email.sendTransferNotification).toHaveBeenCalledOnce();
    expect(email.sendTransferInvitation).not.toHaveBeenCalled();
  });

  it('sends an invitation email when the recipient is not a registered user', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await service.initiate('vehicle-1', 'account-1', 'user-1', 'newuser@example.com');

    expect(email.sendTransferInvitation).toHaveBeenCalledOnce();
    expect(email.sendTransferNotification).not.toHaveBeenCalled();
  });

  it('throws 400 when a pending transfer already exists for the vehicle', async () => {
    transferRepo = makeFakeTransferRepo({ findPendingByVehicleId: vi.fn().mockResolvedValue(mockTransfer) });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.initiate('vehicle-1', 'account-1', 'user-1', 'jordan@example.com'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when the recipient email matches the sender email', async () => {
    await expect(service.initiate('vehicle-1', 'account-1', 'user-1', 'alex@example.com'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when the vehicle does not exist', async () => {
    vehicleRepo = makeFakeVehicleRepo({ findDetailById: vi.fn().mockResolvedValue(null) });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.initiate('vehicle-1', 'account-1', 'user-1', 'jordan@example.com'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when the vehicle belongs to a different account', async () => {
    vehicleRepo = makeFakeVehicleRepo({
      findDetailById: vi.fn().mockResolvedValue({ ...mockVehicleDetail, accountId: 'other-account' }),
    });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.initiate('vehicle-1', 'account-1', 'user-1', 'jordan@example.com'))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns the created transfer', async () => {
    const result = await service.initiate('vehicle-1', 'account-1', 'user-1', 'jordan@example.com');

    expect(result).toEqual(mockTransfer);
  });
});

// ── accept ─────────────────────────────────────────────────────────────────

describe('VehicleTransferService.accept', () => {
  let transferRepo: VehicleTransferRepository;
  let vehicleRepo: VehicleRepository;
  let userRepo: UserRepository;
  let email: EmailSender;
  let service: VehicleTransferService;

  beforeEach(() => {
    vi.clearAllMocks();
    transferRepo = makeFakeTransferRepo();
    vehicleRepo = makeFakeVehicleRepo();
    userRepo = makeFakeUserRepo();
    email = makeFakeEmail();
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);
  });

  it('calls transferVehicle with the transfer id and recipient account id', async () => {
    await service.accept('token-abc', 'account-2');

    expect(transferRepo.transferVehicle).toHaveBeenCalledOnce();
    expect(transferRepo.transferVehicle).toHaveBeenCalledWith('transfer-1', 'account-2');
  });

  it('returns the vehicleId on success', async () => {
    const result = await service.accept('token-abc', 'account-2');

    expect(result).toBe('vehicle-1');
  });

  it('throws 404 when the token does not exist', async () => {
    transferRepo = makeFakeTransferRepo({ findByToken: vi.fn().mockResolvedValue(null) });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.accept('bad-token', 'account-2')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 409 when the transfer is not PENDING', async () => {
    transferRepo = makeFakeTransferRepo({
      findByToken: vi.fn().mockResolvedValue({ ...mockTransfer, status: 'DECLINED' }),
    });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.accept('token-abc', 'account-2')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 404 and sets status to EXPIRED when the transfer has expired', async () => {
    transferRepo = makeFakeTransferRepo({
      findByToken: vi.fn().mockResolvedValue({ ...mockTransfer, expiresAt: pastDate }),
    });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.accept('token-abc', 'account-2')).rejects.toMatchObject({ statusCode: 404 });
    expect(transferRepo.updateStatus).toHaveBeenCalledWith('transfer-1', 'EXPIRED');
  });
});

// ── decline ────────────────────────────────────────────────────────────────

describe('VehicleTransferService.decline', () => {
  let transferRepo: VehicleTransferRepository;
  let vehicleRepo: VehicleRepository;
  let userRepo: UserRepository;
  let email: EmailSender;
  let service: VehicleTransferService;

  beforeEach(() => {
    vi.clearAllMocks();
    transferRepo = makeFakeTransferRepo();
    vehicleRepo = makeFakeVehicleRepo();
    userRepo = makeFakeUserRepo();
    email = makeFakeEmail();
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);
  });

  it('sets status to DECLINED', async () => {
    await service.decline('token-abc');

    expect(transferRepo.updateStatus).toHaveBeenCalledWith('transfer-1', 'DECLINED');
  });

  it('sends a decline notification email to the sender', async () => {
    await service.decline('token-abc');

    expect(email.sendTransferDecline).toHaveBeenCalledOnce();
    expect(email.sendTransferDecline).toHaveBeenCalledWith('alex@example.com', expect.any(String));
  });

  it('throws 404 when token does not exist', async () => {
    transferRepo = makeFakeTransferRepo({ findByToken: vi.fn().mockResolvedValue(null) });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.decline('bad-token')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 409 when the transfer is not PENDING', async () => {
    transferRepo = makeFakeTransferRepo({
      findByToken: vi.fn().mockResolvedValue({ ...mockTransfer, status: 'CANCELLED' }),
    });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.decline('token-abc')).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ── cancel ─────────────────────────────────────────────────────────────────

describe('VehicleTransferService.cancel', () => {
  let transferRepo: VehicleTransferRepository;
  let vehicleRepo: VehicleRepository;
  let userRepo: UserRepository;
  let email: EmailSender;
  let service: VehicleTransferService;

  beforeEach(() => {
    vi.clearAllMocks();
    transferRepo = makeFakeTransferRepo({ findPendingByVehicleId: vi.fn().mockResolvedValue(mockTransfer) });
    vehicleRepo = makeFakeVehicleRepo();
    userRepo = makeFakeUserRepo();
    email = makeFakeEmail();
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);
  });

  it('sets the transfer status to CANCELLED', async () => {
    await service.cancel('vehicle-1', 'account-1');

    expect(transferRepo.updateStatus).toHaveBeenCalledWith('transfer-1', 'CANCELLED');
  });

  it('sends a cancellation email to the recipient', async () => {
    await service.cancel('vehicle-1', 'account-1');

    expect(email.sendTransferCancellation).toHaveBeenCalledOnce();
    expect(email.sendTransferCancellation).toHaveBeenCalledWith(
      'jordan@example.com',
      expect.any(String),
      expect.any(String),
    );
  });

  it('throws 404 when no pending transfer exists', async () => {
    transferRepo = makeFakeTransferRepo({ findPendingByVehicleId: vi.fn().mockResolvedValue(null) });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.cancel('vehicle-1', 'account-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when the vehicle belongs to a different account', async () => {
    vehicleRepo = makeFakeVehicleRepo({
      findDetailById: vi.fn().mockResolvedValue({ ...mockVehicleDetail, accountId: 'other-account' }),
    });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.cancel('vehicle-1', 'account-1')).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── getTransferDetails (lazy expiry) ──────────────────────────────────────

describe('VehicleTransferService.getTransferDetails', () => {
  let transferRepo: VehicleTransferRepository;
  let vehicleRepo: VehicleRepository;
  let userRepo: UserRepository;
  let email: EmailSender;
  let service: VehicleTransferService;

  beforeEach(() => {
    vi.clearAllMocks();
    transferRepo = makeFakeTransferRepo();
    vehicleRepo = makeFakeVehicleRepo();
    userRepo = makeFakeUserRepo();
    email = makeFakeEmail();
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);
  });

  it('returns transfer details for a valid PENDING transfer', async () => {
    const result = await service.getTransferDetails('token-abc', () => null);

    expect(result.status).toBe('PENDING');
    expect(result.vehicle.make).toBe('Honda');
    expect(result.senderName).toBe('Alex Morgan');
  });

  it('sets status to EXPIRED and throws 404 when expiresAt has passed', async () => {
    transferRepo = makeFakeTransferRepo({
      findByToken: vi.fn().mockResolvedValue({ ...mockTransfer, expiresAt: pastDate }),
    });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.getTransferDetails('token-abc', () => null)).rejects.toMatchObject({ statusCode: 404 });
    expect(transferRepo.updateStatus).toHaveBeenCalledWith('transfer-1', 'EXPIRED');
  });

  it('sends expiry email to sender when lazy-expiring', async () => {
    transferRepo = makeFakeTransferRepo({
      findByToken: vi.fn().mockResolvedValue({ ...mockTransfer, expiresAt: pastDate }),
    });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.getTransferDetails('token-abc', () => null)).rejects.toThrow(AppError);
    expect(email.sendTransferExpiry).toHaveBeenCalledOnce();
  });

  it('throws 404 when the token does not exist', async () => {
    transferRepo = makeFakeTransferRepo({ findByToken: vi.fn().mockResolvedValue(null) });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.getTransferDetails('bad-token', () => null)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when the transfer is not in PENDING status', async () => {
    transferRepo = makeFakeTransferRepo({
      findByToken: vi.fn().mockResolvedValue({ ...mockTransfer, status: 'ACCEPTED' }),
    });
    service = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, email, APP_URL);

    await expect(service.getTransferDetails('token-abc', () => null)).rejects.toMatchObject({ statusCode: 404 });
  });
});
