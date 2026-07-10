import type { PrismaClient } from '../generated/prisma/client';
import type { VehicleTransferRepository, VehicleTransfer, CreateTransferData, VehicleTransferStatus } from '../domain';

type TransferDb = Pick<PrismaClient, 'vehicleTransfer' | 'vehicle'>;

function mapTransfer(row: {
  id: string;
  vehicleId: string;
  senderAccountId: string;
  recipientEmail: string;
  recipientAccountId: string | null;
  token: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): VehicleTransfer {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    senderAccountId: row.senderAccountId,
    recipientEmail: row.recipientEmail,
    recipientAccountId: row.recipientAccountId,
    token: row.token,
    status: row.status as VehicleTransferStatus,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaVehicleTransferRepository implements VehicleTransferRepository {
  constructor(private readonly db: TransferDb) {}

  async create(data: CreateTransferData): Promise<VehicleTransfer> {
    const row = await this.db.vehicleTransfer.create({ data });
    return mapTransfer(row);
  }

  async findByToken(token: string): Promise<VehicleTransfer | null> {
    const row = await this.db.vehicleTransfer.findUnique({ where: { token } });
    return row ? mapTransfer(row) : null;
  }

  async findPendingByVehicleId(vehicleId: string): Promise<VehicleTransfer | null> {
    const row = await this.db.vehicleTransfer.findFirst({
      where: { vehicleId, status: 'PENDING' },
    });
    return row ? mapTransfer(row) : null;
  }

  async updateStatus(id: string, status: VehicleTransferStatus): Promise<VehicleTransfer> {
    const row = await this.db.vehicleTransfer.update({
      where: { id },
      data: { status },
    });
    return mapTransfer(row);
  }

  async transferVehicle(transferId: string, recipientAccountId: string): Promise<void> {
    const transfer = await this.db.vehicleTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) return;
    await this.db.vehicle.update({
      where: { id: transfer.vehicleId },
      data: { accountId: recipientAccountId },
    });
    await this.db.vehicleTransfer.update({
      where: { id: transferId },
      data: { status: 'ACCEPTED', recipientAccountId },
    });
  }
}
