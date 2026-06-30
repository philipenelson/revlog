export type VehicleTransferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export interface DomainVehicleTransfer {
  id: string;
  vehicleId: string;
  senderAccountId: string;
  recipientEmail: string;
  recipientAccountId: string | null;
  token: string;
  status: VehicleTransferStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransferData {
  vehicleId: string;
  senderAccountId: string;
  recipientEmail: string;
  recipientAccountId: string | null;
  expiresAt: Date;
}

export interface IVehicleTransferRepository {
  create(data: CreateTransferData): Promise<DomainVehicleTransfer>;
  findByToken(token: string): Promise<DomainVehicleTransfer | null>;
  findPendingByVehicleId(vehicleId: string): Promise<DomainVehicleTransfer | null>;
  updateStatus(id: string, status: VehicleTransferStatus): Promise<DomainVehicleTransfer>;
  transferVehicle(transferId: string, recipientAccountId: string): Promise<void>;
}
