export interface DomainVehicle {
  id: string;
  accountId: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
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
}

export interface IVehicleRepository {
  create(data: CreateVehicleData): Promise<DomainVehicle>;
  // Ordered by updatedAt desc — see garage-list-api.md "Sort order proxy".
  findAllByAccountId(accountId: string): Promise<DomainVehicle[]>;
}
