export type VehicleTransferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export interface VehicleTransfer {
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
