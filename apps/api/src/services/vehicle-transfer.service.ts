import type {
  IVehicleTransferRepository,
  DomainVehicleTransfer,
  IVehicleRepository,
  IUserRepository,
} from '@maintenance-log/domain';
import { AppError } from '../middleware/error';
import { logger } from '../lib/logger';
import type {
  TransferEmailContext,
  sendTransferNotificationEmail,
  sendTransferInvitationEmail,
  sendTransferCancellationEmail,
  sendTransferDeclineEmail,
  sendTransferExpiryEmail,
} from '../lib/email';

type SendNotificationFn = typeof sendTransferNotificationEmail;
type SendInvitationFn = typeof sendTransferInvitationEmail;
type SendCancellationFn = typeof sendTransferCancellationEmail;
type SendDeclineFn = typeof sendTransferDeclineEmail;
type SendExpiryFn = typeof sendTransferExpiryEmail;

export interface VehicleTransferEmailDeps {
  sendTransferNotification: SendNotificationFn;
  sendTransferInvitation: SendInvitationFn;
  sendTransferCancellation: SendCancellationFn;
  sendTransferDecline: SendDeclineFn;
  sendTransferExpiry: SendExpiryFn;
}

export interface TransferDetails {
  status: 'PENDING';
  expiresAt: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    nickname: string | null;
    photoUrl: string | null;
    logEntryCount: number;
  };
  senderName: string;
}

const TRANSFER_TTL_DAYS = 7;

function vehicleDisplayName(make: string, model: string, nickname: string | null): string {
  return nickname?.trim() || `${make} ${model}`;
}

export class VehicleTransferService {
  constructor(
    private readonly transferRepo: IVehicleTransferRepository,
    private readonly vehicleRepo: IVehicleRepository,
    private readonly userRepo: IUserRepository,
    private readonly email: VehicleTransferEmailDeps,
    private readonly appUrl: string,
  ) {}

  async initiate(
    vehicleId: string,
    senderAccountId: string,
    senderUserId: string,
    recipientEmail: string,
  ): Promise<DomainVehicleTransfer> {
    const vehicle = await this.vehicleRepo.findDetailById(vehicleId);
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    if (vehicle.accountId !== senderAccountId) throw new AppError(403, 'Forbidden');

    const senderUser = await this.userRepo.findById(senderUserId);
    const senderEmail = senderUser?.email ?? '';
    const senderName = senderUser?.fullName ?? 'Someone';

    if (recipientEmail === senderEmail) {
      throw new AppError(400, 'Cannot transfer to yourself');
    }

    const existing = await this.transferRepo.findPendingByVehicleId(vehicleId);
    if (existing) {
      throw new AppError(400, 'A pending transfer already exists for this vehicle');
    }

    const recipient = await this.userRepo.findByEmail(recipientEmail);
    const expiresAt = new Date(Date.now() + TRANSFER_TTL_DAYS * 24 * 60 * 60 * 1000);

    const transfer = await this.transferRepo.create({
      vehicleId,
      senderAccountId,
      recipientEmail,
      recipientAccountId: recipient?.accountId ?? null,
      expiresAt,
    });

    const displayName = vehicleDisplayName(vehicle.make, vehicle.model, vehicle.nickname);
    const transferUrl = `${this.appUrl}/transfers/${transfer.token}`;
    const expiresAtStr = expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const ctx: TransferEmailContext = {
      senderName,
      vehicleDisplayName: displayName,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleYear: vehicle.year,
      logEntryCount: vehicle.logEntries.length,
      expiresAt: expiresAtStr,
    };

    if (recipient) {
      await this.email.sendTransferNotification(recipientEmail, ctx, transferUrl);
    } else {
      const registerUrl = `${this.appUrl}/register?transferToken=${transfer.token}`;
      await this.email.sendTransferInvitation(recipientEmail, ctx, registerUrl);
    }

    logger.info({ vehicleId, senderAccountId, recipientEmail }, 'vehicle transfer initiated');
    return transfer;
  }

  async getTransferDetails(token: string, photoUrlBuilder: (path: string | null) => string | null): Promise<TransferDetails> {
    const transfer = await this.transferRepo.findByToken(token);

    if (!transfer || transfer.status !== 'PENDING') {
      throw new AppError(404, 'Transfer not found or no longer valid');
    }

    if (transfer.expiresAt < new Date()) {
      await this.transferRepo.updateStatus(transfer.id, 'EXPIRED');
      const vehicle = await this.vehicleRepo.findDetailById(transfer.vehicleId);
      if (vehicle) {
        const displayName = vehicleDisplayName(vehicle.make, vehicle.model, vehicle.nickname);
        await this.email.sendTransferExpiry(
          await this._getSenderEmail(transfer.senderAccountId),
          displayName,
        );
      }
      throw new AppError(404, 'Transfer not found or no longer valid');
    }

    const vehicle = await this.vehicleRepo.findDetailById(transfer.vehicleId);
    if (!vehicle) throw new AppError(404, 'Transfer not found or no longer valid');

    const sender = await this.userRepo.findByAccountId(transfer.senderAccountId);

    return {
      status: 'PENDING',
      expiresAt: transfer.expiresAt.toISOString(),
      vehicle: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        nickname: vehicle.nickname,
        photoUrl: photoUrlBuilder(vehicle.photoPath),
        logEntryCount: vehicle.logEntries.length,
      },
      senderName: sender?.fullName ?? 'Someone',
    };
  }

  async accept(token: string, recipientAccountId: string): Promise<string> {
    const transfer = await this.transferRepo.findByToken(token);

    if (!transfer) throw new AppError(404, 'Transfer not found or no longer valid');
    if (transfer.status !== 'PENDING') throw new AppError(409, 'Transfer already resolved');
    if (transfer.expiresAt < new Date()) {
      await this.transferRepo.updateStatus(transfer.id, 'EXPIRED');
      throw new AppError(404, 'Transfer not found or no longer valid');
    }

    await this.transferRepo.transferVehicle(transfer.id, recipientAccountId);
    logger.info({ transferId: transfer.id, recipientAccountId }, 'vehicle transfer accepted');
    return transfer.vehicleId;
  }

  async decline(token: string): Promise<void> {
    const transfer = await this.transferRepo.findByToken(token);

    if (!transfer) throw new AppError(404, 'Transfer not found or no longer valid');
    if (transfer.status !== 'PENDING') throw new AppError(409, 'Transfer already resolved');

    await this.transferRepo.updateStatus(transfer.id, 'DECLINED');

    const vehicle = await this.vehicleRepo.findDetailById(transfer.vehicleId);
    const displayName = vehicle
      ? vehicleDisplayName(vehicle.make, vehicle.model, vehicle.nickname)
      : 'your vehicle';

    const senderEmail = await this._getSenderEmail(transfer.senderAccountId);
    await this.email.sendTransferDecline(senderEmail, displayName);

    logger.info({ transferId: transfer.id }, 'vehicle transfer declined');
  }

  async cancel(vehicleId: string, senderAccountId: string): Promise<void> {
    const vehicle = await this.vehicleRepo.findDetailById(vehicleId);
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    if (vehicle.accountId !== senderAccountId) throw new AppError(403, 'Forbidden');

    const transfer = await this.transferRepo.findPendingByVehicleId(vehicleId);
    if (!transfer) throw new AppError(404, 'No pending transfer for this vehicle');

    await this.transferRepo.updateStatus(transfer.id, 'CANCELLED');

    const displayName = vehicleDisplayName(vehicle.make, vehicle.model, vehicle.nickname);
    const senderUser = await this.userRepo.findByAccountId(senderAccountId);
    await this.email.sendTransferCancellation(
      transfer.recipientEmail,
      senderUser?.fullName ?? 'The sender',
      displayName,
    );

    logger.info({ vehicleId, senderAccountId }, 'vehicle transfer cancelled');
  }

  private async _getSenderEmail(senderAccountId: string): Promise<string> {
    const user = await this.userRepo.findByAccountId(senderAccountId);
    return user?.email ?? '';
  }
}
