import { createVehicle, updateVehicle, ApiError, type HttpClient } from '@maintenance-log/api-client';
import { RetryableOutboxError, type OutboxHandler } from './SyncService';
import { logger } from '@/infrastructure/logging/logger';

interface CreateVehicleOutboxPayload {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

interface UpdateVehicleOutboxPayload {
  vehicleId: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

// A 4xx (validation, 403, 404) means the mutation itself is rejected —
// retrying won't help, so it's permanent (flushOutbox marks it 'failed';
// server-wins conflict policy reverts the local row on the next pull, per
// ADR 0027). Anything else — 5xx, TimeoutError, a raw network failure — is
// classified retryable so a single offline/degraded moment doesn't
// permanently drop the Owner's edit.
function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500;
  return true;
}

// Builds the outbox type -> handler map SyncService.flushOutbox() dispatches
// on. One `client` per call site (SyncProvider passes tokenHttpClient) —
// handlers are pure functions of that client, not stateful themselves.
export function createOutboxHandlers(client: HttpClient): Record<string, OutboxHandler> {
  return {
    CREATE_VEHICLE: async (payload) => {
      const data = payload as CreateVehicleOutboxPayload;
      try {
        await createVehicle(client, data);
      } catch (err) {
        if (isRetryable(err)) {
          throw new RetryableOutboxError(err instanceof Error ? err.message : 'network error');
        }
        logger.warn('outbox: CREATE_VEHICLE rejected by the API, dropping local change', {
          vehicleId: data.id,
          err: String(err),
        });
        throw err;
      }
    },

    UPDATE_VEHICLE: async (payload) => {
      const { vehicleId, ...data } = payload as UpdateVehicleOutboxPayload;
      try {
        await updateVehicle(client, vehicleId, data);
      } catch (err) {
        if (isRetryable(err)) {
          throw new RetryableOutboxError(err instanceof Error ? err.message : 'network error');
        }
        logger.warn('outbox: UPDATE_VEHICLE rejected by the API, dropping local change', {
          vehicleId,
          err: String(err),
        });
        throw err;
      }
    },
  };
}
