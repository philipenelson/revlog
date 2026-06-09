import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  const logEntryTypes = ['MAINTENANCE', 'REPAIR', 'INSPECTION', 'MODIFICATION', 'INCIDENT', 'EVENT', 'OTHER'];
  const itemCategories = ['PART', 'LABOR', 'FEE', 'OTHER'];

  for (const id of logEntryTypes) {
    await db.logEntryType.upsert({ where: { id }, update: {}, create: { id } });
  }
  for (const id of itemCategories) {
    await db.itemCategory.upsert({ where: { id }, update: {}, create: { id } });
  }

  console.log('Seed complete: LogEntryType and ItemCategory records upserted.');
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
