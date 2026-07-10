import type { NewsletterSubscriber } from '../models/NewsletterSubscriber';

export interface NewsletterRepository {
  findByEmail(email: string): Promise<NewsletterSubscriber | null>;
  create(email: string): Promise<NewsletterSubscriber>;
}
