import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { logger } from './logger';

const PRINTOUT_EMAIL_TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'templates', 'mechanic-printout-email.html'),
  'utf-8',
);

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
    from: process.env.SMTP_FROM ?? 'noreply@revlog.app',
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

export async function sendMechanicPrintoutEmail(params: MechanicPrintoutEmailParams): Promise<void> {
  const {
    to, ownerName, vehicleDisplayName, vehicleMake, vehicleModel, vehicleYear,
    logEntryCount, reportUrl,
  } = params;

  const subject = `${ownerName} shared a vehicle service history with you`;

  const html = PRINTOUT_EMAIL_TEMPLATE
    .replace(/\{\{ownerName\}\}/g, ownerName)
    .replace(/\{\{vehicleDisplayName\}\}/g, vehicleDisplayName)
    .replace(/\{\{vehicleMake\}\}/g, vehicleMake)
    .replace(/\{\{vehicleModel\}\}/g, vehicleModel)
    .replace(/\{\{vehicleYear\}\}/g, String(vehicleYear))
    .replace(/\{\{logEntryCount\}\}/g, String(logEntryCount))
    .replace(/\{\{reportUrl\}\}/g, reportUrl);

  const text = [
    `${ownerName} shared a vehicle service history with you`,
    ``,
    `Vehicle: ${vehicleDisplayName} (${vehicleMake} ${vehicleModel} ${vehicleYear})`,
    `Log entries: ${logEntryCount}`,
    ``,
    `View the service history:`,
    reportUrl,
    ``,
    `Use your browser's print function (Ctrl/Cmd + P) to save as PDF.`,
  ].join('\n');

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? 'noreply@revlog.app',
    to,
    subject,
    text,
    html,
  });

  logger.info({ to }, 'mechanic printout email sent');
}
