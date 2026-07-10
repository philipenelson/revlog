import type {
  EmailSender,
  MechanicPrintoutEmailParams,
  TransferEmailContext,
} from '../../application/ports/EmailSender';
import * as email from '../../lib/email';

// Driven adapter (ADR 0039): implements the EmailSender port with Nodemailer,
// delegating to the transport functions in lib/email. This is the single place
// that maps the port's method names onto the concrete send functions.
export class NodemailerEmailSender implements EmailSender {
  sendVerificationEmail(to: string, code: string): Promise<void> {
    return email.sendVerificationEmail(to, code);
  }

  sendPasswordResetEmail(to: string, code: string): Promise<void> {
    return email.sendPasswordResetEmail(to, code);
  }

  sendMechanicPrintoutEmail(params: MechanicPrintoutEmailParams): Promise<void> {
    return email.sendMechanicPrintoutEmail(params);
  }

  sendTransferNotification(to: string, ctx: TransferEmailContext, transferUrl: string): Promise<void> {
    return email.sendTransferNotificationEmail(to, ctx, transferUrl);
  }

  sendTransferInvitation(to: string, ctx: TransferEmailContext, registerUrl: string): Promise<void> {
    return email.sendTransferInvitationEmail(to, ctx, registerUrl);
  }

  sendTransferCancellation(to: string, senderName: string, vehicleDisplayName: string): Promise<void> {
    return email.sendTransferCancellationEmail(to, senderName, vehicleDisplayName);
  }

  sendTransferDecline(to: string, vehicleDisplayName: string): Promise<void> {
    return email.sendTransferDeclineEmail(to, vehicleDisplayName);
  }

  sendTransferExpiry(to: string, vehicleDisplayName: string): Promise<void> {
    return email.sendTransferExpiryEmail(to, vehicleDisplayName);
  }
}
