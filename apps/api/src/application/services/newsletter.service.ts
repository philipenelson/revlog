import type { NewsletterSubscribeInput } from '@maintenance-log/contracts';
import type { NewsletterRepository } from '../../domain';
import { logger } from '../../lib/logger';

export class NewsletterService {
  constructor(private readonly newsletterRepo: NewsletterRepository) {}

  async subscribe(input: NewsletterSubscribeInput): Promise<{ created: boolean }> {
    const existing = await this.newsletterRepo.findByEmail(input.email);

    if (existing) {
      logger.info({ email: input.email }, 'newsletter subscribe: already subscribed');
      return { created: false };
    }

    await this.newsletterRepo.create(input.email);
    logger.info({ email: input.email }, 'newsletter subscribe: new subscriber');
    return { created: true };
  }
}
