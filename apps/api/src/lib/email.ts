import nodemailer from 'nodemailer';
import { logger } from './logger';

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
