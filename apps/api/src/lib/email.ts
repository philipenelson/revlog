import nodemailer from 'nodemailer';
import { logger } from './logger';

const FROM = process.env.SMTP_FROM ?? 'noreply@revlog.app';

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 1025),
  auth:
    process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
});

export async function sendVerificationEmail(
  to: string,
  token: string,
  appUrl: string,
): Promise<void> {
  const link = `${appUrl}/verify-email?token=${token}`;

  await transport.sendMail({
    from: FROM,
    to,
    subject: 'Verify your Revlog account',
    text: [
      `Click the link below to verify your email address. The link expires in 24 hours.`,
      ``,
      link,
      ``,
      `If you didn't create a Revlog account, you can ignore this email.`,
    ].join('\n'),
  });

  logger.info({ to }, 'verification email sent');
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

export async function sendTransferNotificationEmail(
  to: string,
  ctx: TransferEmailContext,
  transferUrl: string,
): Promise<void> {
  await transport.sendMail({
    from: FROM,
    to,
    subject: `${ctx.senderName} wants to transfer ${ctx.vehicleDisplayName} to you`,
    text: [
      `${ctx.senderName} wants to transfer ${ctx.vehicleDisplayName} (${ctx.vehicleMake} ${ctx.vehicleModel} ${ctx.vehicleYear}) to you on Revlog.`,
      ``,
      `This transfer includes the vehicle's complete service history of ${ctx.logEntryCount} log entries.`,
      ``,
      `Accept or decline — this transfer expires on ${ctx.expiresAt}.`,
      ``,
      `Review transfer: ${transferUrl}`,
      ``,
      `Not expecting this? You can safely ignore this email — no changes will be made to your account.`,
    ].join('\n'),
  });

  logger.info({ to }, 'transfer notification email sent');
}

export async function sendTransferInvitationEmail(
  to: string,
  ctx: TransferEmailContext,
  registerUrl: string,
): Promise<void> {
  await transport.sendMail({
    from: FROM,
    to,
    subject: `You've been invited to receive a vehicle on Revlog`,
    text: [
      `${ctx.senderName} wants to transfer ${ctx.vehicleDisplayName} (${ctx.vehicleMake} ${ctx.vehicleModel} ${ctx.vehicleYear}) to you on Revlog.`,
      ``,
      `This transfer includes the vehicle's complete service history of ${ctx.logEntryCount} log entries.`,
      ``,
      `Create a free Revlog account to accept or decline — this transfer expires on ${ctx.expiresAt}.`,
      ``,
      `Create account and review transfer: ${registerUrl}`,
    ].join('\n'),
  });

  logger.info({ to }, 'transfer invitation email sent');
}

export async function sendTransferCancellationEmail(
  to: string,
  senderName: string,
  vehicleDisplayName: string,
): Promise<void> {
  await transport.sendMail({
    from: FROM,
    to,
    subject: `${senderName} cancelled the vehicle transfer`,
    text: [
      `${senderName} has cancelled the transfer of ${vehicleDisplayName}.`,
      ``,
      `No action is required on your part.`,
    ].join('\n'),
  });

  logger.info({ to }, 'transfer cancellation email sent');
}

export async function sendTransferDeclineEmail(
  to: string,
  vehicleDisplayName: string,
): Promise<void> {
  await transport.sendMail({
    from: FROM,
    to,
    subject: `Your transfer of ${vehicleDisplayName} was declined`,
    text: [
      `Your transfer of ${vehicleDisplayName} was declined by the recipient.`,
      ``,
      `The vehicle is back in your Garage.`,
    ].join('\n'),
  });

  logger.info({ to }, 'transfer decline email sent');
}

export async function sendTransferExpiryEmail(
  to: string,
  vehicleDisplayName: string,
): Promise<void> {
  await transport.sendMail({
    from: FROM,
    to,
    subject: `Your transfer of ${vehicleDisplayName} has expired`,
    text: [
      `Your transfer of ${vehicleDisplayName} expired without a response from the recipient.`,
      ``,
      `The vehicle is back in your Garage.`,
    ].join('\n'),
  });

  logger.info({ to }, 'transfer expiry email sent');
}
