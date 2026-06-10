export interface DomainNewsletterSubscriber {
  id: string;
  email: string;
  createdAt: Date;
}

export interface INewsletterRepository {
  findByEmail(email: string): Promise<DomainNewsletterSubscriber | null>;
  create(email: string): Promise<DomainNewsletterSubscriber>;
}
