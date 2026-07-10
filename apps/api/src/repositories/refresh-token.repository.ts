import type { PrismaClient } from '../generated/prisma/client';
import type { RefreshTokenRepository, RefreshToken, CreateRefreshTokenData } from '../domain';

type RefreshTokenDb = Pick<PrismaClient, 'refreshToken'>;

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: RefreshTokenDb) {}

  async create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return this.db.refreshToken.create({ data });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.db.refreshToken.findUnique({ where: { tokenHash } });
  }

  async deleteById(id: string): Promise<void> {
    await this.db.refreshToken.delete({ where: { id } });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.refreshToken.deleteMany({ where: { userId } });
  }
}
