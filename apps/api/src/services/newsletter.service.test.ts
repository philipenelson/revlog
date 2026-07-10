import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsletterService } from './newsletter.service';
import type { NewsletterRepository, NewsletterSubscriber } from '../domain';

const fixedNow = new Date('2026-01-01T00:00:00Z');

const mockSubscriber: NewsletterSubscriber = {
  id: 'sub-1',
  email: 'test@example.com',
  createdAt: fixedNow,
};

function makeFakeNewsletterRepo(overrides: Partial<NewsletterRepository> = {}): NewsletterRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(mockSubscriber),
    ...overrides,
  };
}

describe('NewsletterService.subscribe', () => {
  let newsletterRepo: NewsletterRepository;
  let service: NewsletterService;

  beforeEach(() => {
    vi.clearAllMocks();
    newsletterRepo = makeFakeNewsletterRepo();
    service = new NewsletterService(newsletterRepo);
  });

  it('creates a new subscriber when the email is not already subscribed', async () => {
    const result = await service.subscribe({ email: 'new@example.com' });

    expect(newsletterRepo.create).toHaveBeenCalledWith('new@example.com');
    expect(result).toEqual({ created: true });
  });

  it('does not create a duplicate when the email is already subscribed', async () => {
    newsletterRepo = makeFakeNewsletterRepo({ findByEmail: vi.fn().mockResolvedValue(mockSubscriber) });
    service = new NewsletterService(newsletterRepo);

    const result = await service.subscribe({ email: mockSubscriber.email });

    expect(newsletterRepo.create).not.toHaveBeenCalled();
    expect(result).toEqual({ created: false });
  });

  it('looks up the email before creating', async () => {
    await service.subscribe({ email: 'new@example.com' });

    expect(newsletterRepo.findByEmail).toHaveBeenCalledWith('new@example.com');
  });
});
