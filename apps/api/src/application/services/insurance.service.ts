import type { UpsertInsuranceInput } from '@maintenance-log/domain';
import type { VehicleInsurance, VehicleRepository, InsuranceRepository } from '../../domain';
import { AppError } from '../../adapters/http/middleware/error';
import { logger } from '../../lib/logger';

export class InsuranceService {
  constructor(
    private readonly insuranceRepo: InsuranceRepository,
    private readonly vehicleRepo: VehicleRepository,
  ) {}

  private async assertVehicleOwnership(vehicleId: string, accountId: string): Promise<void> {
    const detail = await this.vehicleRepo.findDetailById(vehicleId);
    if (!detail) throw new AppError(404, 'Vehicle not found');
    if (detail.accountId !== accountId) throw new AppError(403, 'Forbidden');
  }

  async getInsurance(vehicleId: string, accountId: string): Promise<VehicleInsurance> {
    await this.assertVehicleOwnership(vehicleId, accountId);
    const insurance = await this.insuranceRepo.findByVehicleId(vehicleId);
    if (!insurance) throw new AppError(404, 'No insurance on file');
    logger.info({ accountId, vehicleId }, 'insurance fetched');
    return insurance;
  }

  async upsertInsurance(
    vehicleId: string,
    accountId: string,
    input: UpsertInsuranceInput,
  ): Promise<VehicleInsurance> {
    await this.assertVehicleOwnership(vehicleId, accountId);
    const insurance = await this.insuranceRepo.upsert(vehicleId, input);
    logger.info({ accountId, vehicleId }, 'insurance upserted');
    return insurance;
  }

  async deleteInsurance(vehicleId: string, accountId: string): Promise<void> {
    await this.assertVehicleOwnership(vehicleId, accountId);
    const deleted = await this.insuranceRepo.delete(vehicleId);
    if (!deleted) throw new AppError(404, 'No insurance on file');
    logger.info({ accountId, vehicleId }, 'insurance deleted');
  }
}
