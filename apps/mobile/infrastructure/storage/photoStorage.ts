import { Directory, File, Paths } from 'expo-file-system';
import type { PhotoStore, PickedPhoto, StablePhoto } from '@/domain/ports/PhotoStore';

const PHOTOS_DIR_NAME = 'vehicle-photos';

// Copies a picked photo -- whose uri may point to the image picker's own
// temporary, cache-scoped location -- into this app's stable document
// storage, named after `vehicleId`. This is what lets a CREATE_VEHICLE
// outbox entry's photo survive the picker's temp files being cleared, and
// survive an app restart while that entry is still pending offline. See ADR
// 0027's 2026-07-03 "offline-durable photo upload" update.
export async function persistVehiclePhoto(vehicleId: string, photo: PickedPhoto): Promise<StablePhoto> {
  const dir = new Directory(Paths.document, PHOTOS_DIR_NAME);
  dir.create({ idempotent: true });
  const source = new File(photo.uri);
  const destination = new File(dir, `${vehicleId}${source.extension}`);
  await source.copy(destination);
  return { uri: destination.uri, name: photo.name, type: photo.type };
}

// Called once a photo's upload has reached a terminal outcome (succeeded,
// or permanently rejected) -- nothing will try this file again either way.
export function deleteVehiclePhoto(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
}

// Opens a live File handle on a stable photo reference, for the
// CREATE_VEHICLE outbox handler to actually upload. `File` implements
// `Blob` (arrayBuffer/bytes/slice/stream/type) -- required because Expo's
// own fetch (this app's global `fetch`) only accepts a real Blob-like value
// for a FormData file part; a plain `{ uri, name, type }` descriptor (the
// classic React Native FormData convention, and this outbox entry's own
// serializable payload shape) throws "Unsupported FormDataPart
// implementation" there. This is the one place that plain descriptor gets
// converted into something actually uploadable.
export function openVehiclePhotoFile(uri: string): File {
  return new File(uri);
}

// The PhotoStore port adapter (ADR 0041): the persist/remove surface the
// domain's VehicleRepository depends on. openVehiclePhotoFile stays a plain
// module function — it's used only by the outbox handler (adapter→adapter),
// not by the domain, so it is not part of the port.
export const photoStore: PhotoStore = {
  persist: persistVehiclePhoto,
  remove: deleteVehiclePhoto,
};
