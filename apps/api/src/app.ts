import path from 'path';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma';
import { UPLOADS_DIR } from './lib/upload';
import {
  sendVerificationEmail,
  sendTransferNotificationEmail,
  sendTransferInvitationEmail,
  sendTransferCancellationEmail,
  sendTransferDeclineEmail,
  sendTransferExpiryEmail,
} from './lib/email';
import { PrismaUserRepository } from './repositories/user.repository';
import { PrismaRefreshTokenRepository } from './repositories/refresh-token.repository';
import { PrismaAccountRepository } from './repositories/account.repository';
import { PrismaVehicleRepository } from './repositories/vehicle.repository';
import { PrismaVehicleTransferRepository } from './repositories/vehicle-transfer.repository';
import { PrismaLogEntryRepository } from './repositories/log-entry.repository';
import { PrismaInsuranceRepository } from './repositories/insurance.repository';
import { PrismaNewsletterRepository } from './repositories/newsletter.repository';
import { AuthService } from './services/auth.service';
import { VehicleService } from './services/vehicle.service';
import { VehicleTransferService } from './services/vehicle-transfer.service';
import { AccountService } from './services/account.service';
import { LogEntryService } from './services/log-entry.service';
import { InsuranceService } from './services/insurance.service';
import { NewsletterService } from './services/newsletter.service';
import { createAuthRouter } from './routes/auth';
import { createVehicleRouter } from './routes/vehicles';
import { createTransferRouter } from './routes/transfers';
import { createOnboardingRouter } from './routes/onboarding';
import { createLogEntryRouter } from './routes/log-entries';
import { createInsuranceRouter } from './routes/insurance';
import { createLookupRouter } from './routes/lookup';
import { createNewsletterRouter } from './routes/newsletter';
import { errorMiddleware } from './middleware/error';

const allowedOrigins = [
  process.env.APP_URL ?? 'http://localhost:3000',
  process.env.WEBSITE_URL ?? 'http://localhost:4321',
];

export function createApp(): Express {
  // Composition root — the only place concrete implementations are wired together.
  const userRepo = new PrismaUserRepository(prisma);
  const refreshTokenRepo = new PrismaRefreshTokenRepository(prisma);
  const accountRepo = new PrismaAccountRepository(prisma);
  const vehicleRepo = new PrismaVehicleRepository(prisma);
  const transferRepo = new PrismaVehicleTransferRepository(prisma);
  const logEntryRepo = new PrismaLogEntryRepository(prisma);
  const insuranceRepo = new PrismaInsuranceRepository(prisma);
  const newsletterRepo = new PrismaNewsletterRepository(prisma);
  const authService = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail });
  const vehicleService = new VehicleService(vehicleRepo, accountRepo);
  const transferService = new VehicleTransferService(transferRepo, vehicleRepo, userRepo, {
    sendTransferNotification: sendTransferNotificationEmail,
    sendTransferInvitation: sendTransferInvitationEmail,
    sendTransferCancellation: sendTransferCancellationEmail,
    sendTransferDecline: sendTransferDeclineEmail,
    sendTransferExpiry: sendTransferExpiryEmail,
  }, process.env.APP_URL ?? 'http://localhost:3000');
  const accountService = new AccountService(accountRepo);
  const logEntryService = new LogEntryService(logEntryRepo, vehicleRepo, prisma);
  const insuranceService = new InsuranceService(insuranceRepo, vehicleRepo);
  const newsletterService = new NewsletterService(newsletterRepo);

  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
  // Allow the web app (cross-origin) to load uploaded images directly via <img>.
  // Helmet sets Cross-Origin-Resource-Policy: same-origin by default, which
  // blocks cross-origin image fetches without CORS. Override for /uploads only.
  app.use('/uploads', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(path.join(UPLOADS_DIR)));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', createAuthRouter(authService));
  app.use('/vehicles', createVehicleRouter(vehicleService, transferService));
  app.use('/transfers', createTransferRouter(transferService));
  app.use('/vehicles/:vehicleId/insurance', createInsuranceRouter(insuranceService));
  app.use('/vehicles/:vehicleId/log', createLogEntryRouter(logEntryService));
  app.use('/onboarding', createOnboardingRouter(accountService));
  app.use('/newsletter', createNewsletterRouter(newsletterService));

  app.use(createLookupRouter());

  app.use(errorMiddleware);

  return app;
}
