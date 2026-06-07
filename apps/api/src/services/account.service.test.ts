import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountService } from './account.service';
import type { IAccountRepository, DomainAccount } from '@maintenance-log/domain';

const fixedNow = new Date('2026-01-01T00:00:00Z');

const mockAccount: DomainAccount = {
  id: 'account-1',
  type: 'PERSONAL',
  status: 'ONBOARDING',
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

function makeFakeAccountRepo(overrides: Partial<IAccountRepository> = {}): IAccountRepository {
  return {
    create: vi.fn().mockResolvedValue(mockAccount),
    findById: vi.fn().mockResolvedValue(mockAccount),
    markActive: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AccountService.skipOnboarding', () => {
  let accountRepo: IAccountRepository;
  let service: AccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    accountRepo = makeFakeAccountRepo();
    service = new AccountService(accountRepo);
  });

  it('transitions the account out of onboarding', async () => {
    await service.skipOnboarding('account-1');

    expect(accountRepo.markActive).toHaveBeenCalledOnce();
    expect(accountRepo.markActive).toHaveBeenCalledWith('account-1');
  });
});
