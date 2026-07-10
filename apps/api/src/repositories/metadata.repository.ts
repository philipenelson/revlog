import type { PrismaClient } from '../generated/prisma/client';
import type { MetadataRepository } from '../domain';

type MetadataDb = Pick<PrismaClient, 'logEntryType' | 'itemCategory'>;

export class PrismaMetadataRepository implements MetadataRepository {
  constructor(private readonly db: MetadataDb) {}

  async logEntryTypeExists(id: string): Promise<boolean> {
    const row = await this.db.logEntryType.findUnique({ where: { id }, select: { id: true } });
    return row !== null;
  }

  async itemCategoryExists(id: string): Promise<boolean> {
    const row = await this.db.itemCategory.findUnique({ where: { id }, select: { id: true } });
    return row !== null;
  }
}
