import { render, waitFor } from '@testing-library/react-native';
import { DatabaseProvider, useDatabase } from './DatabaseProvider';

// Only openDatabase() is mocked — createSQLiteStore()/the repository
// factories run for real, since they don't touch the connection until one
// of their methods is actually called (never, in this test). Verifies the
// provider's own job: open once, build both repositories, flip isReady.
jest.mock('@/infrastructure/database/openDatabase', () => ({ openDatabase: jest.fn() }));

import { openDatabase } from '@/infrastructure/database/openDatabase';

const mockOpenDatabase = openDatabase as jest.MockedFunction<typeof openDatabase>;

let latestValue: ReturnType<typeof useDatabase> | undefined;

function Probe() {
  latestValue = useDatabase();
  return null;
}

describe('DatabaseProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
    latestValue = undefined;
  });

  it('becomes ready with both repositories once the database opens', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOpenDatabase.mockResolvedValue({} as any);

    await render(
      <DatabaseProvider>
        <Probe />
      </DatabaseProvider>,
    );

    await waitFor(() => expect(latestValue!.isReady).toBe(true));
    expect(mockOpenDatabase).toHaveBeenCalledTimes(1);
    expect(latestValue!.vehicleRepository).toHaveProperty('findAll');
    expect(latestValue!.vehicleRepository).toHaveProperty('reconcile');
    expect(latestValue!.outboxRepository).toHaveProperty('enqueue');
    expect(latestValue!.outboxRepository).toHaveProperty('listPending');
  });
});
