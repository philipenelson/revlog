// Outbound port (ADR 0039): the transactional emails the application sends.
// One capability interface; each service depends on it and calls the subset it
// needs. The Nodemailer implementation lives in adapters/email/NodemailerEmailSender.

export interface MechanicPrintoutEmailParams {
  to: string;
  ownerName: string;
  vehicleDisplayName: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  logEntryCount: number;
  reportUrl: string;
}

export interface TransferEmailContext {
  senderName: string;
  vehicleDisplayName: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  logEntryCount: number;
  expiresAt: string;
}

export interface EmailSender {
  sendVerificationEmail(to: string, code: string): Promise<void>;
  sendPasswordResetEmail(to: string, code: string): Promise<void>;
  sendMechanicPrintoutEmail(params: MechanicPrintoutEmailParams): Promise<void>;
  sendTransferNotification(to: string, ctx: TransferEmailContext, transferUrl: string): Promise<void>;
  sendTransferInvitation(to: string, ctx: TransferEmailContext, registerUrl: string): Promise<void>;
  sendTransferCancellation(to: string, senderName: string, vehicleDisplayName: string): Promise<void>;
  sendTransferDecline(to: string, vehicleDisplayName: string): Promise<void>;
  sendTransferExpiry(to: string, vehicleDisplayName: string): Promise<void>;
}
