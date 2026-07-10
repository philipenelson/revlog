// Photo storage port (ADR 0041). The core owns the picked/stable photo shapes
// and the persist/remove contract; the adapter (adapters/storage/photoStorage)
// implements it over the file system. This is the one storage wrapper a domain
// repository (VehicleRepository) depends on, so — unlike the other single-impl
// storage wrappers — it earns a port to keep domain/ free of native deps.

// A photo as chosen from the image picker — its `uri` may point at the
// picker's own temporary, cache-scoped location.
export interface PickedPhoto {
  uri: string;
  name: string;
  type: string;
}

// A photo copied into stable, app-owned local storage (same shape; the `uri`
// now points at a durable file:// path).
export type StablePhoto = PickedPhoto;

export interface PhotoStore {
  // Copies a picked photo into stable local storage, keyed by `vehicleId`, so
  // an offline-pending outbox entry's photo survives the picker's temp files
  // being cleared and an app restart. Returns the stable reference.
  persist(vehicleId: string, photo: PickedPhoto): Promise<StablePhoto>;
  // Deletes a stable local photo file once its upload reaches a terminal
  // outcome (succeeded or permanently rejected).
  remove(uri: string): void;
}
