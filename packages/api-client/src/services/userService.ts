import type { HttpClient } from '../HttpClient';
import type { UserProfile } from '../types';

/** The current user's profile (GET /users/me). Cached locally on mobile for offline display (ADR 0033). */
export function getCurrentUser(client: HttpClient): Promise<UserProfile> {
  return client.get<UserProfile>('/users/me');
}
