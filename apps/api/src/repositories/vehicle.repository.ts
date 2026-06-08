import type { PrismaClient } from '../generated/prisma/client';
import type { IVehicleRepository, DomainVehicle, CreateVehicleData } from '@maintenance-log/domain';

type VehicleDb = Pick<PrismaClient, 'vehicle'>;

export class PrismaVehicleRepository implements IVehicleRepository {
  constructor(private readonly db: VehicleDb) {}

  async create(data: CreateVehicleData): Promise<DomainVehicle> {
    return this.db.vehicle.create({ data });
  }

  async findAllByAccountId(accountId: string): Promise<DomainVehicle[]> {
    return this.db.vehicle.findMany({
      where: { accountId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async setPhoto(vehicleId: string, accountId: string, photoPath: string): Promise<DomainVehicle | null> {
    const updated = await this.db.vehicle.updateMany({
      where: { id: vehicleId, accountId },
      data: { photoPath },
    });
    if (updated.count === 0) return null;
    return this.db.vehicle.findUnique({ where: { id: vehicleId } }) as Promise<DomainVehicle>;
  }
}
