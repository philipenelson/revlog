import { createProfileRepository } from './ProfileRepository';
import type { Store } from '@/domain/ports/Store';
import type { UserProfile } from '@maintenance-log/api-client';

const profile: UserProfile = { id: 'u1', fullName: 'Philip Russo', email: 'p@example.com', role: 'OWNER' };

function fakeStore(rows: UserProfile[] = []): jest.Mocked<Store<UserProfile>> {
  return {
    getAll: jest.fn(async () => rows),
    save: jest.fn(),
    remove: jest.fn(),
    replaceAll: jest.fn(),
  };
}

describe('ProfileRepository', () => {
  it('get() returns the cached profile row', async () => {
    const repo = createProfileRepository(fakeStore([profile]));
    expect(await repo.get()).toEqual(profile);
  });

  it('get() returns null when nothing is cached (fresh install / not yet synced)', async () => {
    const repo = createProfileRepository(fakeStore([]));
    expect(await repo.get()).toBeNull();
  });

  it('save() replaces the whole collection so only one profile row ever exists', async () => {
    const store = fakeStore([{ ...profile, id: 'previous-user' }]);
    const repo = createProfileRepository(store);

    await repo.save(profile);

    expect(store.replaceAll).toHaveBeenCalledWith([profile]);
    expect(store.save).not.toHaveBeenCalled();
  });
});
