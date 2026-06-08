import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma';
import { sendVerificationEmail } from './lib/email';
import { PrismaUserRepository } from './repositories/user.repository';
import { PrismaRefreshTokenRepository } from './repositories/refresh-token.repository';
import { PrismaAccountRepository } from './repositories/account.repository';
import { PrismaVehicleRepository } from './repositories/vehicle.repository';
import { AuthService } from './services/auth.service';
import { VehicleService } from './services/vehicle.service';
import { AccountService } from './services/account.service';
import { createAuthRouter } from './routes/auth';
import { createVehicleRouter } from './routes/vehicles';
import { createOnboardingRouter } from './routes/onboarding';
import { errorMiddleware } from './middleware/error';

const allowedOrigins = [process.env.APP_URL ?? 'http://localhost:3000'];

export function createApp(): Express {
  // Composition root — the only place concrete implementations are wired together.
  const userRepo = new PrismaUserRepository(prisma);
  const refreshTokenRepo = new PrismaRefreshTokenRepository(prisma);
  const accountRepo = new PrismaAccountRepository(prisma);
  const vehicleRepo = new PrismaVehicleRepository(prisma);
  const authService = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail });
  const vehicleService = new VehicleService(vehicleRepo, accountRepo);
  const accountService = new AccountService(accountRepo);

  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', createAuthRouter(authService));
  app.use('/vehicles', createVehicleRouter(vehicleService));
  app.use('/onboarding', createOnboardingRouter(accountService));

  app.use(errorMiddleware);

  return app;
}
