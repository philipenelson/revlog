import type { PrismaClient } from '../../generated/prisma/client';
import type { NewsletterRepository, NewsletterSubscriber } from '../../domain';

type NewsletterDb = Pick<PrismaClient, 'newsletterSubscriber'>;

export class PrismaNewsletterRepository implements NewsletterRepository {
  constructor(private readonly db: NewsletterDb) {}

  async findByEmail(email: string): Promise<NewsletterSubscriber | null> {
    return this.db.newsletterSubscriber.findUnique({ where: { email } });
  }

  async create(email: string): Promise<NewsletterSubscriber> {
    return this.db.newsletterSubscriber.create({ data: { email } });
  }
}
