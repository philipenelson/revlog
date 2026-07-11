import type { CreateVehicleInput, UpdateVehicleInput } from '@maintenance-log/contracts';
import type { Vehicle, VehicleDetail, VehicleRepository, AccountRepository } from '../../domain';
import { AppError } from '../../adapters/http/middleware/error';
import { logger } from '../../lib/logger';

export class VehicleService {
  constructor(
    private readonly vehicleRepo: VehicleRepository,
    private readonly accountRepo: AccountRepository,
  ) {}

  async createVehicle(
    accountId: string,
    input: CreateVehicleInput,
    photoPath: string | null = null,
  ): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.create({ accountId, ...input, photoPath });
    await this.accountRepo.markActive(accountId);
    logger.info({ accountId, vehicleId: vehicle.id }, 'vehicle created');
    return vehicle;
  }

  async listVehicles(accountId: string): Promise<(Vehicle & { logEntryCount: number })[]> {
    return this.vehicleRepo.findAllByAccountId(accountId);
  }

  async setVehiclePhoto(vehicleId: string, accountId: string, photoPath: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.setPhoto(vehicleId, accountId, photoPath);
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    logger.info({ accountId, vehicleId, photoPath }, 'vehicle photo updated');
    return vehicle;
  }

  async getDetail(vehicleId: string, accountId: string): Promise<VehicleDetail> {
    const detail = await this.vehicleRepo.findDetailById(vehicleId);
    if (!detail) throw new AppError(404, 'Vehicle not found');
    if (detail.accountId !== accountId) throw new AppError(403, 'Forbidden');
    logger.info({ accountId, vehicleId }, 'vehicle detail fetched');
    return detail;
  }

  async updateVehicle(vehicleId: string, accountId: string, input: UpdateVehicleInput): Promise<Vehicle> {
    const detail = await this.vehicleRepo.findDetailById(vehicleId);
    if (!detail) throw new AppError(404, 'Vehicle not found');
    if (detail.accountId !== accountId) throw new AppError(403, 'Forbidden');
    const vehicle = await this.vehicleRepo.update(vehicleId, input);
    logger.info({ accountId, vehicleId }, 'vehicle updated');
    return vehicle;
  }

  async deleteVehicle(vehicleId: string, accountId: string): Promise<void> {
    const detail = await this.vehicleRepo.findDetailById(vehicleId);
    if (!detail) throw new AppError(404, 'Vehicle not found');
    if (detail.accountId !== accountId) throw new AppError(403, 'Forbidden');
    await this.vehicleRepo.delete(vehicleId);
    logger.info({ accountId, vehicleId }, 'vehicle deleted');
  }
}
