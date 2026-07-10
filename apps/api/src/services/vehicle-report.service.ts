import type { VehicleReportTokenRepository, VehicleRepository, MechanicPrintout } from '../domain';
import type { EmailSender } from '../application/ports/EmailSender';
import { AppError } from '../middleware/error';
import { logger } from '../lib/logger';

export class VehicleReportService {
  constructor(
    private readonly reportTokenRepo: VehicleReportTokenRepository,
    private readonly vehicleRepo: VehicleRepository,
    private readonly emailer: EmailSender,
    private readonly appUrl: string,
  ) {}

  async createToken(vehicleId: string, accountId: string): Promise<{ shareToken: string; shareUrl: string }> {
    const vehicle = await this.vehicleRepo.findDetailById(vehicleId);
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    if (vehicle.accountId !== accountId) throw new AppError(403, 'Forbidden');

    const row = await this.reportTokenRepo.upsertByVehicleId(vehicleId);
    const shareUrl = `${this.appUrl}/report/${row.token}`;

    logger.info({ accountId, vehicleId }, 'vehicle report token created');
    return { shareToken: row.token, shareUrl };
  }

  async revokeToken(vehicleId: string, accountId: string): Promise<void> {
    const vehicle = await this.vehicleRepo.findDetailById(vehicleId);
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    if (vehicle.accountId !== accountId) throw new AppError(403, 'Forbidden');

    const deleted = await this.reportTokenRepo.deleteByVehicleId(vehicleId);
    if (!deleted) throw new AppError(404, 'No active share token for this vehicle');

    logger.info({ accountId, vehicleId }, 'vehicle report token revoked');
  }

  async emailLink(vehicleId: string, accountId: string, email: string): Promise<void> {
    const vehicle = await this.vehicleRepo.findDetailById(vehicleId);
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    if (vehicle.accountId !== accountId) throw new AppError(403, 'Forbidden');

    const tokenRow = await this.reportTokenRepo.findByVehicleId(vehicleId);
    if (!tokenRow) throw new AppError(404, 'No active share token for this vehicle');

    const shareUrl = `${this.appUrl}/report/${tokenRow.token}`;
    const vehicleDisplayName =
      vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;
    const logEntryCount = vehicle.logEntries.length;

    await this.emailer.sendMechanicPrintoutEmail({
      to: email,
      ownerName: 'The owner',
      vehicleDisplayName,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleYear: vehicle.year,
      logEntryCount,
      reportUrl: shareUrl,
    });

    logger.info({ accountId, vehicleId, to: email }, 'mechanic printout email sent');
  }

  async getByShareToken(token: string): Promise<MechanicPrintout | null> {
    return this.reportTokenRepo.findPrintoutByToken(token);
  }

  async getActiveToken(vehicleId: string, accountId: string): Promise<{ shareToken: string; shareUrl: string } | null> {
    const vehicle = await this.vehicleRepo.findDetailById(vehicleId);
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    if (vehicle.accountId !== accountId) throw new AppError(403, 'Forbidden');

    const row = await this.reportTokenRepo.findByVehicleId(vehicleId);
    if (!row) return null;
    return { shareToken: row.token, shareUrl: `${this.appUrl}/report/${row.token}` };
  }
}
