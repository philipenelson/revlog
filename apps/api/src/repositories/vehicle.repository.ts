import type { PrismaClient } from '../generated/prisma/client';
import type {
  IVehicleRepository,
  DomainVehicle,
  CreateVehicleData,
  UpdateVehicleData,
  DomainVehicleDetail,
  DomainVehicleInsurance,
} from '@maintenance-log/domain';
import type { LogEntrySummary } from '@maintenance-log/domain';

type VehicleDb = Pick<PrismaClient, 'vehicle'>;

function formatDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function mapInsurance(row: {
  company: string | null;
  policyNumber: string | null;
  startDate: Date | null;
  expiryDate: Date | null;
  premium: { toString(): string } | null;
  premiumPeriod: 'MONTHLY' | 'QUARTERLY' | 'BIANNUAL' | 'ANNUAL' | null;
  towNumber: string | null;
  notes: string | null;
} | null): DomainVehicleInsurance | null {
  if (!row) return null;
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

export class PrismaVehicleRepository implements IVehicleRepository {
  constructor(private readonly db: VehicleDb) {}

  async create(data: CreateVehicleData): Promise<DomainVehicle> {
    return this.db.vehicle.create({ data });
  }

  async findAllByAccountId(accountId: string): Promise<DomainVehicle[]> {
    return this.db.vehicle.findMany({
      where: { accountId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async setPhoto(vehicleId: string, accountId: string, photoPath: string): Promise<DomainVehicle | null> {
    const updated = await this.db.vehicle.updateMany({
      where: { id: vehicleId, accountId },
      data: { photoPath },
    });
    if (updated.count === 0) return null;
    return this.db.vehicle.findUnique({ where: { id: vehicleId } }) as Promise<DomainVehicle>;
  }

  async update(vehicleId: string, data: UpdateVehicleData): Promise<DomainVehicle> {
    return this.db.vehicle.update({ where: { id: vehicleId }, data });
  }

  async delete(vehicleId: string): Promise<void> {
    await this.db.vehicle.delete({ where: { id: vehicleId } });
  }

  async findDetailById(vehicleId: string): Promise<DomainVehicleDetail | null> {
    const row = await this.db.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        insurance: true,
        logEntries: {
          include: {
            items: { select: { quantity: true, unitCost: true } },
            _count: { select: { media: true } },
          },
          orderBy: { date: 'desc' },
        },
      },
    });
    if (!row) return null;

    const logEntries: LogEntrySummary[] = row.logEntries.map((entry) => {
      const costs = entry.items
        .filter((i) => i.quantity != null && i.unitCost != null)
        .map((i) => Number(i.quantity) * Number(i.unitCost));
      const totalCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0).toFixed(2) : null;
      return {
        id: entry.id,
        typeId: entry.typeId,
        title: entry.title,
        date: formatDate(entry.date)!,
        time: entry.time,
        mileage: entry.mileage,
        itemCount: entry.items.length,
        mediaCount: entry._count.media,
        totalCost,
      };
    });

    const allCosts = logEntries
      .filter((e) => e.totalCost != null)
      .map((e) => Number(e.totalCost));
    const totalSpent = allCosts.length > 0
      ? allCosts.reduce((a, b) => a + b, 0).toFixed(2)
      : '0.00';
    const lastLoggedAt = logEntries.length > 0 ? logEntries[0].date : null;

    return {
      id: row.id,
      accountId: row.accountId,
      nickname: row.nickname,
      make: row.make,
      model: row.model,
      year: row.year,
      mileage: row.mileage,
      photoPath: row.photoPath,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      insurance: mapInsurance(row.insurance),
      logEntries,
      stats: { totalSpent, lastLoggedAt },
    };
  }
}
