import { Directory, File, Paths } from 'expo-file-system';

export interface PickedPhoto {
  uri: string;
  name: string;
  type: string;
}

export type StablePhoto = PickedPhoto;

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
