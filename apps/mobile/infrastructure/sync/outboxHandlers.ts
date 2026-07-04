import { createVehicle, createVehicleWithPhotoUri, updateVehicle, setVehiclePhotoUri, deleteVehicle, createLogEntry, ApiError, type HttpClient } from '@maintenance-log/api-client';
import { RetryableOutboxError, type OutboxHandler } from './SyncService';
import { logger } from '@/infrastructure/logging/logger';
import { deleteVehiclePhoto, openVehiclePhotoFile } from '@/infrastructure/storage/photoStorage';

interface CreateVehicleOutboxPayload {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  // Present only when the Owner picked a photo on Add Vehicle -- the stable
  // local reference persistVehiclePhoto() wrote before this entry was
  // enqueued. See ADR 0027's 2026-07-03 "offline-durable photo upload"
  // update.
  photo?: { uri: string; name: string; type: string };
}

interface UpdateVehicleOutboxPayload {
  vehicleId: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  // Present only when the Owner picked a replacement photo on Edit Vehicle
  // (UC-MOB-VEH-6) -- the stable local reference persistVehiclePhoto()
  // wrote before this entry was enqueued. See ADR 0027's 2026-07-04
  // "offline-durable photo upload extended to Edit Vehicle" update.
  photo?: { uri: string; name: string; type: string };
}

interface DeleteVehicleOutboxPayload {
  vehicleId: string;
}

// Mirrors LogEntryRepository.CreateLogEntryData plus the vehicleId needed
// for the URL -- see its create()'s doc comment for why no local `id` is
// carried here (no API support for a client-supplied Log Entry id, and
// nothing navigates by it before the next sync's reconcile() fixes it up).
interface CreateLogEntryOutboxPayload {
  vehicleId: string;
  typeId: string;
  title: string;
  date: string;
  mileage: number;
  notes: string | null;
  items: Array<{
    categoryId: string;
    description: string;
    quantity: number | null;
    unitCost: number | null;
  }>;
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
      const { photo, ...data } = payload as CreateVehicleOutboxPayload;
      try {
        if (photo) {
          await createVehicleWithPhotoUri(client, data, openVehiclePhotoFile(photo.uri));
        } else {
          await createVehicle(client, data);
        }
      } catch (err) {
        if (isRetryable(err)) {
          throw new RetryableOutboxError(err instanceof Error ? err.message : 'network error');
        }
        logger.warn('outbox: CREATE_VEHICLE rejected by the API, dropping local change', {
          vehicleId: data.id,
          err: String(err),
        });
        // Terminal outcome (permanent failure) -- nothing will retry this
        // file, same reasoning as the success path below.
        if (photo) deleteVehiclePhoto(photo.uri);
        throw err;
      }
      // Only after a terminal success -- a retryable failure above leaves
      // the file in place for the next flush attempt to find.
      if (photo) deleteVehiclePhoto(photo.uri);
    },

    UPDATE_VEHICLE: async (payload) => {
      const { vehicleId, photo, ...data } = payload as UpdateVehicleOutboxPayload;
      try {
        await updateVehicle(client, vehicleId, data);
        if (photo) {
          await setVehiclePhotoUri(client, vehicleId, openVehiclePhotoFile(photo.uri));
        }
      } catch (err) {
        if (isRetryable(err)) {
          throw new RetryableOutboxError(err instanceof Error ? err.message : 'network error');
        }
        logger.warn('outbox: UPDATE_VEHICLE rejected by the API, dropping local change', {
          vehicleId,
          err: String(err),
        });
        // Terminal outcome (permanent failure of either call) -- nothing
        // will retry this entry, so nothing will ever attempt this file
        // again either. Same reasoning as CREATE_VEHICLE's cleanup below.
        if (photo) deleteVehiclePhoto(photo.uri);
        throw err;
      }
      // Only after a terminal success -- a retryable failure above leaves
      // the file in place for the next flush attempt to find.
      if (photo) deleteVehiclePhoto(photo.uri);
    },

    DELETE_VEHICLE: async (payload) => {
      const { vehicleId } = payload as DeleteVehicleOutboxPayload;
      try {
        await deleteVehicle(client, vehicleId);
      } catch (err) {
        if (isRetryable(err)) {
          throw new RetryableOutboxError(err instanceof Error ? err.message : 'network error');
        }
        // A 404 here means the Vehicle is already gone server-side (e.g.
        // deleted from another device) -- the local delete already reached
        // its intended end state either way, so this is logged and dropped
        // the same as any other permanent rejection, not retried.
        logger.warn('outbox: DELETE_VEHICLE rejected by the API, dropping local change', {
          vehicleId,
          err: String(err),
        });
        throw err;
      }
    },

    CREATE_LOG_ENTRY: async (payload) => {
      const { vehicleId, items, ...data } = payload as CreateLogEntryOutboxPayload;
      try {
        await createLogEntry(client, vehicleId, {
          ...data,
          time: null, // not collected on mobile -- see docs/specs/mobile-app/log-entry.md
          items: items.map((item, sortOrder) => ({ ...item, sortOrder })),
        });
      } catch (err) {
        if (isRetryable(err)) {
          throw new RetryableOutboxError(err instanceof Error ? err.message : 'network error');
        }
        logger.warn('outbox: CREATE_LOG_ENTRY rejected by the API, dropping local change', {
          vehicleId,
          err: String(err),
        });
        throw err;
      }
    },
  };
}
