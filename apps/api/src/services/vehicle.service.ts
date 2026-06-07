import type {
  CreateVehicleInput,
  DomainVehicle,
  IVehicleRepository,
  IAccountRepository,
} from '@maintenance-log/domain';
import { logger } from '../lib/logger';

export class VehicleService {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly accountRepo: IAccountRepository,
  ) {}

  async createVehicle(accountId: string, input: CreateVehicleInput): Promise<DomainVehicle> {
    const vehicle = await this.vehicleRepo.create({ accountId, ...input });
    await this.accountRepo.markActive(accountId);
    logger.info({ accountId, vehicleId: vehicle.id }, 'vehicle created');
    return vehicle;
  }
}
