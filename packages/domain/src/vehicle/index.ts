export interface DomainVehicle {
  id: string;
  accountId: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  photoPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleData {
  accountId: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  photoPath: string | null;
}

export interface IVehicleRepository {
  create(data: CreateVehicleData): Promise<DomainVehicle>;
  // Ordered by updatedAt desc — see garage-list-api.md "Sort order proxy".
  findAllByAccountId(accountId: string): Promise<DomainVehicle[]>;
  // Scoped update — returns null when the vehicle does not exist or
  // belongs to a different account (guards the photo upload endpoint).
  setPhoto(vehicleId: string, accountId: string, photoPath: string): Promise<DomainVehicle | null>;
}
