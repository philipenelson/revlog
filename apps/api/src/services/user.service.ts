import type { IUserRepository } from '@maintenance-log/domain';
import { AppError } from '../middleware/error';
import { logger } from '../lib/logger';

// Public projection of a User — never carries passwordHash, verification
// tokens, or timestamps. See docs/specs/user/user-api.md.
export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export class UserService {
  constructor(private readonly userRepo: IUserRepository) {}

  // The "current user" for GET /users/me — the caller resolved from the
  // access token's `sub`, never an arbitrary id (see ADR 0033).
  async getCurrentUser(userId: string): Promise<UserProfile> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError(404, 'User not found');
    logger.debug({ userId }, 'fetched current user');
    return { id: user.id, fullName: user.fullName, email: user.email, role: user.role };
  }
}
