import { act, render, waitFor } from '@testing-library/react-native';
import type { Session } from '@maintenance-log/api-client';
import { SyncProvider, useSync } from './SyncProvider';

jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: jest.fn() }));
jest.mock('@/application/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/application/providers/DatabaseProvider', () => ({ useDatabase: jest.fn() }));
jest.mock('@/infrastructure/sync/SyncService', () => ({ createSyncService: jest.fn() }));
jest.mock('@/infrastructure/http/TokenHttpClient', () => ({ tokenHttpClient: {} }));

import { useNetInfo } from '@react-native-community/netinfo';
import { useAuth } from '@/application/providers/AuthProvider';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import { createSyncService } from '@/infrastructure/sync/SyncService';

const mockUseNetInfo = useNetInfo as jest.MockedFunction<typeof useNetInfo>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseDatabase = useDatabase as jest.MockedFunction<typeof useDatabase>;
const mockCreateSyncService = createSyncService as jest.MockedFunction<typeof createSyncService>;

const fakeSession: Session = {
  accessToken: 'access-token',
  accessTokenExpiresAt: new Date().toISOString(),
  user: { id: 'user-1', accountId: 'account-1', role: 'OWNER' },
  account: { id: 'account-1', status: 'ACTIVE' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeVehicleRepository = {} as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeOutboxRepository = { listPending: jest.fn(async () => []) } as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeLogEntryRepository = {} as any;

let latestValue: ReturnType<typeof useSync> | undefined;

function Probe() {
  latestValue = useSync();
  return null;
}

function setReady(session: Session | null) {
  mockUseAuth.mockReturnValue({ session, isRestoring: false, isOffline: false, hasStoredCredentials: false, setSession: jest.fn(), clearSession: jest.fn() });
  mockUseDatabase.mockReturnValue({
    isReady: true,
    vehicleRepository: fakeVehicleRepository,
    outboxRepository: fakeOutboxRepository,
    logEntryRepository: fakeLogEntryRepository,
  });
  mockUseNetInfo.mockReturnValue({ isConnected: true } as ReturnType<typeof useNetInfo>);
}

describe('SyncProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
    latestValue = undefined;
  });

  it('runs a full sync on mount once authenticated and the database is ready', async () => {
    setReady(fakeSession);
    const runFullSync = jest.fn(async () => {});
    mockCreateSyncService.mockReturnValue({ pull: jest.fn(), flushOutbox: jest.fn(), runFullSync });

    await render(
      <SyncProvider>
        <Probe />
      </SyncProvider>,
    );

    await waitFor(() => expect(runFullSync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(latestValue!.lastSyncedAt).not.toBeNull());
    expect(latestValue!.syncStatus).toBe('idle');
    expect(latestValue!.pendingCount).toBe(0);
  });

  it('does not sync when there is no session', async () => {
    setReady(null);
    const runFullSync = jest.fn(async () => {});
    mockCreateSyncService.mockReturnValue({ pull: jest.fn(), flushOutbox: jest.fn(), runFullSync });

    await render(
      <SyncProvider>
        <Probe />
      </SyncProvider>,
    );

    expect(runFullSync).not.toHaveBeenCalled();
    expect(latestValue!.lastSyncedAt).toBeNull();
  });

  it('sets syncStatus to error when the sync fails, without throwing', async () => {
    setReady(fakeSession);
    const runFullSync = jest.fn(async () => {
      throw new Error('network down');
    });
    mockCreateSyncService.mockReturnValue({ pull: jest.fn(), flushOutbox: jest.fn(), runFullSync });

    await render(
      <SyncProvider>
        <Probe />
      </SyncProvider>,
    );

    await waitFor(() => expect(latestValue!.syncStatus).toBe('error'));
    expect(latestValue!.lastSyncedAt).toBeNull();
  });

  it('coalesces overlapping refresh() calls into a single in-flight sync', async () => {
    setReady(fakeSession);
    const deferred: Array<() => void> = [];
    const runFullSync = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          deferred.push(resolve);
        }),
    );
    mockCreateSyncService.mockReturnValue({ pull: jest.fn(), flushOutbox: jest.fn(), runFullSync });

    await render(
      <SyncProvider>
        <Probe />
      </SyncProvider>,
    );
    await waitFor(() => expect(runFullSync).toHaveBeenCalledTimes(1));

    // A manual pull-to-refresh (or a reconnect/foreground trigger) firing
    // while the mount-triggered sync is still in flight must not start a
    // second, overlapping SyncService.runFullSync() call -- see the
    // "no such file" photo-upload race this coalescing prevents.
    const overlapping = latestValue!.refresh();
    expect(runFullSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred[0]!();
      await overlapping;
    });
    expect(runFullSync).toHaveBeenCalledTimes(1);

    // A later, non-overlapping refresh() still triggers its own sync --
    // the guard only coalesces truly concurrent calls, it doesn't wedge.
    const later = latestValue!.refresh();
    expect(runFullSync).toHaveBeenCalledTimes(2);
    await act(async () => {
      deferred[1]!();
      await later;
    });
  });

  it('reflects netinfo connectivity as isOnline', async () => {
    mockUseAuth.mockReturnValue({ session: null, isRestoring: false, isOffline: false, hasStoredCredentials: false, setSession: jest.fn(), clearSession: jest.fn() });
    mockUseDatabase.mockReturnValue({
      isReady: false,
      vehicleRepository: null,
      outboxRepository: null,
      logEntryRepository: null,
    });
    mockUseNetInfo.mockReturnValue({ isConnected: false } as ReturnType<typeof useNetInfo>);

    await render(
      <SyncProvider>
        <Probe />
      </SyncProvider>,
    );

    expect(latestValue!.isOnline).toBe(false);
  });
});
