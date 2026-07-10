import path from 'path';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma';
import { UPLOADS_DIR } from './lib/upload';
import { NodemailerEmailSender } from './adapters/email/NodemailerEmailSender';
import { JwtTokenService } from './adapters/token/JwtTokenService';
import { PrismaUserRepository } from './adapters/persistence/user.repository';
import { PrismaRefreshTokenRepository } from './adapters/persistence/refresh-token.repository';
import { PrismaAccountRepository } from './adapters/persistence/account.repository';
import { PrismaVehicleRepository } from './adapters/persistence/vehicle.repository';
import { PrismaVehicleTransferRepository } from './adapters/persistence/vehicle-transfer.repository';
import { PrismaLogEntryRepository } from './adapters/persistence/log-entry.repository';
import { PrismaInsuranceRepository } from './adapters/persistence/insurance.repository';
import { PrismaNewsletterRepository } from './adapters/persistence/newsletter.repository';
import { PrismaVehicleReportTokenRepository } from './adapters/persistence/vehicle-report-token.repository';
import { PrismaMetadataRepository } from './adapters/persistence/metadata.repository';
import { AuthService } from './application/services/auth.service';
import { UserService } from './application/services/user.service';
import { VehicleService } from './application/services/vehicle.service';
import { VehicleTransferService } from './application/services/vehicle-transfer.service';
import { AccountService } from './application/services/account.service';
import { LogEntryService } from './application/services/log-entry.service';
import { InsuranceService } from './application/services/insurance.service';
import { NewsletterService } from './application/services/newsletter.service';
import { VehicleReportService } from './application/services/vehicle-report.service';
import { createAuthRouter } from './adapters/http/routers/auth';
import { createUsersRouter } from './adapters/http/routers/users';
import { createVehicleRouter } from './adapters/http/routers/vehicles';
import { createTransferRouter } from './adapters/http/routers/transfers';
import { createOnboardingRouter } from './adapters/http/routers/onboarding';
import { createLogEntryRouter } from './adapters/http/routers/log-entries';
import { createInsuranceRouter } from './adapters/http/routers/insurance';
import { createLookupRouter } from './adapters/http/routers/lookup';
import { createNewsletterRouter } from './adapters/http/routers/newsletter';
import { createReportRouter, createVehicleReportTokenRouter } from './adapters/http/routers/report';
import { errorMiddleware } from './adapters/http/middleware/error';

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
  const vehicleReportTokenRepo = new PrismaVehicleReportTokenRepository(prisma);
  const metadataRepo = new PrismaMetadataRepository(prisma);
  const emailSender = new NodemailerEmailSender();
  const tokenService = new JwtTokenService();
  const authService = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailSender, tokenService);
  const userService = new UserService(userRepo);
  const vehicleService = new VehicleService(vehicleRepo, accountRepo);
  const transferService = new VehicleTransferService(
    transferRepo,
    vehicleRepo,
    userRepo,
    emailSender,
    process.env.APP_URL ?? 'http://localhost:3000',
  );
  const accountService = new AccountService(accountRepo);
  const logEntryService = new LogEntryService(logEntryRepo, vehicleRepo, metadataRepo);
  const insuranceService = new InsuranceService(insuranceRepo, vehicleRepo);
  const newsletterService = new NewsletterService(newsletterRepo);
  const vehicleReportService = new VehicleReportService(
    vehicleReportTokenRepo,
    vehicleRepo,
    emailSender,
    process.env.APP_URL ?? 'http://localhost:3000',
  );

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
  app.use('/users', createUsersRouter(userService));
  app.use('/vehicles', createVehicleRouter(vehicleService, transferService));
  app.use('/transfers', createTransferRouter(transferService));
  app.use('/vehicles/:vehicleId/insurance', createInsuranceRouter(insuranceService));
  app.use('/vehicles/:vehicleId/log', createLogEntryRouter(logEntryService));
  app.use('/vehicles/:vehicleId/report-token', createVehicleReportTokenRouter(vehicleReportService));
  app.use('/report', createReportRouter(vehicleReportService));
  app.use('/onboarding', createOnboardingRouter(accountService));
  app.use('/newsletter', createNewsletterRouter(newsletterService));

  app.use(createLookupRouter());

  app.use(errorMiddleware);

  return app;
}
