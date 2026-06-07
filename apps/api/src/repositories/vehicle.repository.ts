import type { PrismaClient } from '../generated/prisma/client';
import type { IVehicleRepository, DomainVehicle, CreateVehicleData } from '@maintenance-log/domain';

type VehicleDb = Pick<PrismaClient, 'vehicle'>;

export class PrismaVehicleRepository implements IVehicleRepository {
  constructor(private readonly db: VehicleDb) {}

  async create(data: CreateVehicleData): Promise<DomainVehicle> {
    return this.db.vehicle.create({ data });
  }
}
