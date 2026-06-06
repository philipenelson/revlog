import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { prisma } from './lib/prisma';
import { sendVerificationEmail } from './lib/email';
import { PrismaUserRepository } from './repositories/user.repository';
import { PrismaRefreshTokenRepository } from './repositories/refresh-token.repository';
import { AuthService } from './services/auth.service';
import { createAuthRouter } from './routes/auth';
import { errorMiddleware } from './middleware/error';

const allowedOrigins = [process.env.APP_URL ?? 'http://localhost:3000'];

export function createApp(): Express {
  // Composition root — the only place concrete implementations are wired together.
  const userRepo = new PrismaUserRepository(prisma);
  const refreshTokenRepo = new PrismaRefreshTokenRepository(prisma);
  const authService = new AuthService(userRepo, refreshTokenRepo, { sendVerificationEmail });

  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', createAuthRouter(authService));

  app.use(errorMiddleware);

  return app;
}
