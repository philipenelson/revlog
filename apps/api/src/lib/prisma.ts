import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { logger } from './logger';

type GlobalWithPrisma = typeof globalThis & { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
  });
  const adapter = new PrismaPg(pool);
  const level = process.env.LOG_LEVEL ?? 'info';

  const client = new PrismaClient({
    adapter,
    log:
      level === 'debug'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ],
  });

  client.$on('query', (e) => logger.debug({ query: e.query, duration: e.duration }, 'prisma query'));
  client.$on('info', (e) => logger.info({ message: e.message }, 'prisma info'));
  client.$on('warn', (e) => logger.warn({ message: e.message }, 'prisma warn'));
  client.$on('error', (e) => logger.error({ message: e.message }, 'prisma error'));

  return client;
}

const globalWithPrisma = globalThis as GlobalWithPrisma;

export const prisma = globalWithPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalWithPrisma.prisma = prisma;
}
