import type { Store, StoreQueryOptions } from '@/infrastructure/database/Store';
import { createOutboxRepository, type OutboxEntry } from './OutboxRepository';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'generated-id') }));

function fakeStore(initial: OutboxEntry[] = []) {
  let rows = initial;
  const store: Store<OutboxEntry> = {
    getAll: jest.fn(async (options?: StoreQueryOptions<OutboxEntry>) => {
      let result = rows;
      if (options?.where) {
        const entries = Object.entries(options.where) as [keyof OutboxEntry, unknown][];
        result = result.filter((row) => entries.every(([field, value]) => row[field] === value));
      }
      if (options?.orderBy) {
        const { field, direction } = options.orderBy;
        result = [...result].sort((a, b) => {
          const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
          return direction === 'desc' ? -cmp : cmp;
        });
      }
      return result;
    }),
    save: jest.fn(async (record: OutboxEntry) => {
      rows = [...rows.filter((r) => r.id !== record.id), record];
    }),
    remove: jest.fn(async (id: string) => {
      rows = rows.filter((r) => r.id !== id);
    }),
    replaceAll: jest.fn(async (records: OutboxEntry[]) => {
      rows = records;
    }),
  };
  return { store, getRows: () => rows };
}

describe('OutboxRepository', () => {
  afterEach(() => jest.clearAllMocks());

  it('enqueue writes a pending entry with a generated id and timestamp', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const { store, getRows } = fakeStore();
    const repo = createOutboxRepository(store);

    await repo.enqueue('CREATE_VEHICLE', { make: 'Honda' });

    expect(getRows()).toEqual([
      {
        id: 'generated-id',
        type: 'CREATE_VEHICLE',
        payload: JSON.stringify({ make: 'Honda' }),
        createdAt: 1_700_000_000_000,
        status: 'pending',
      },
    ]);
  });

  it('listPending returns only pending entries, ordered by createdAt ascending', async () => {
    const { store } = fakeStore([
      { id: 'a', type: 'CREATE_VEHICLE', payload: '{}', createdAt: 200, status: 'pending' },
      { id: 'b', type: 'CREATE_VEHICLE', payload: '{}', createdAt: 100, status: 'failed' },
      { id: 'c', type: 'CREATE_VEHICLE', payload: '{}', createdAt: 50, status: 'pending' },
    ]);
    const repo = createOutboxRepository(store);

    const result = await repo.listPending();

    expect(result.map((e) => e.id)).toEqual(['c', 'a']);
  });

  it('markStatus updates the entry status in place', async () => {
    const { store, getRows } = fakeStore([
      { id: 'a', type: 'CREATE_VEHICLE', payload: '{}', createdAt: 100, status: 'pending' },
    ]);
    const repo = createOutboxRepository(store);

    await repo.markStatus('a', 'failed');

    expect(getRows()).toEqual([{ id: 'a', type: 'CREATE_VEHICLE', payload: '{}', createdAt: 100, status: 'failed' }]);
  });

  it('markStatus is a no-op when the entry no longer exists', async () => {
    const { store } = fakeStore([]);
    const repo = createOutboxRepository(store);

    await repo.markStatus('missing', 'failed');

    expect(store.save).not.toHaveBeenCalled();
  });

  it('remove deletes the entry', async () => {
    const { store, getRows } = fakeStore([
      { id: 'a', type: 'CREATE_VEHICLE', payload: '{}', createdAt: 100, status: 'pending' },
    ]);
    const repo = createOutboxRepository(store);

    await repo.remove('a');

    expect(getRows()).toEqual([]);
  });
});
