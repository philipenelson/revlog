import type { RefreshToken, CreateRefreshTokenData } from '../models/RefreshToken';

export interface RefreshTokenRepository {
  create(data: CreateRefreshTokenData): Promise<RefreshToken>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  deleteById(id: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
