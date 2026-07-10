import type { PrismaClient } from '../../generated/prisma/client';
import type { UpsertInsuranceInput } from '@maintenance-log/domain';
import type { VehicleInsurance, InsuranceRepository } from '../../domain';

type InsuranceDb = Pick<PrismaClient, 'vehicleInsurance'>;

function formatDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

type InsuranceRow = {
  company: string | null;
  policyNumber: string | null;
  startDate: Date | null;
  expiryDate: Date | null;
  premium: { toString(): string } | null;
  premiumPeriod: 'MONTHLY' | 'QUARTERLY' | 'BIANNUAL' | 'ANNUAL' | null;
  towNumber: string | null;
  notes: string | null;
};

function mapRow(row: InsuranceRow): VehicleInsurance {
  return {
    company: row.company,
    policyNumber: row.policyNumber,
    startDate: formatDate(row.startDate),
    expiryDate: formatDate(row.expiryDate),
    premium: row.premium ? row.premium.toString() : null,
    premiumPeriod: row.premiumPeriod,
    towNumber: row.towNumber,
    notes: row.notes,
  };
}

export class PrismaInsuranceRepository implements InsuranceRepository {
  constructor(private readonly db: InsuranceDb) {}

  async findByVehicleId(vehicleId: string): Promise<VehicleInsurance | null> {
    const row = await this.db.vehicleInsurance.findUnique({ where: { vehicleId } });
    if (!row) return null;
    return mapRow(row);
  }

  async upsert(vehicleId: string, input: UpsertInsuranceInput): Promise<VehicleInsurance> {
    const data = {
      company: input.company ?? null,
      policyNumber: input.policyNumber ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      premium: input.premium ?? null,
      premiumPeriod: input.premiumPeriod ?? null,
      towNumber: input.towNumber ?? null,
      notes: input.notes ?? null,
    };

    const row = await this.db.vehicleInsurance.upsert({
      where: { vehicleId },
      create: { vehicleId, ...data },
      update: data,
    });

    return mapRow(row);
  }

  async delete(vehicleId: string): Promise<boolean> {
    try {
      await this.db.vehicleInsurance.delete({ where: { vehicleId } });
      return true;
    } catch {
      return false;
    }
  }
}
