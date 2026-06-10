import type { PrismaClient } from '../generated/prisma/client';
import type { INewsletterRepository, DomainNewsletterSubscriber } from '@maintenance-log/domain';

type NewsletterDb = Pick<PrismaClient, 'newsletterSubscriber'>;

export class PrismaNewsletterRepository implements INewsletterRepository {
  constructor(private readonly db: NewsletterDb) {}

  async findByEmail(email: string): Promise<DomainNewsletterSubscriber | null> {
    return this.db.newsletterSubscriber.findUnique({ where: { email } });
  }

  async create(email: string): Promise<DomainNewsletterSubscriber> {
    return this.db.newsletterSubscriber.create({ data: { email } });
  }
}
