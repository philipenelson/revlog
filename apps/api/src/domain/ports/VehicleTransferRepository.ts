import type {
  VehicleTransfer,
  CreateTransferData,
  VehicleTransferStatus,
} from '../models/VehicleTransfer';

export interface VehicleTransferRepository {
  create(data: CreateTransferData): Promise<VehicleTransfer>;
  findByToken(token: string): Promise<VehicleTransfer | null>;
  findPendingByVehicleId(vehicleId: string): Promise<VehicleTransfer | null>;
  updateStatus(id: string, status: VehicleTransferStatus): Promise<VehicleTransfer>;
  transferVehicle(transferId: string, recipientAccountId: string): Promise<void>;
}
