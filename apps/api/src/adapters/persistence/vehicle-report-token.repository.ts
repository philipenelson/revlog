import type { PrismaClient } from '../../generated/prisma/client';
import type { VehicleReportTokenRepository, VehicleReportToken, MechanicPrintout, PrintoutLogEntry } from '../../domain';

type Db = Pick<PrismaClient, 'vehicleReportToken' | 'vehicle'>;

function dateToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export class PrismaVehicleReportTokenRepository implements VehicleReportTokenRepository {
  constructor(private readonly db: Db) {}

  async upsertByVehicleId(vehicleId: string): Promise<VehicleReportToken> {
    await this.db.vehicleReportToken.deleteMany({ where: { vehicleId } });
    return this.db.vehicleReportToken.create({ data: { vehicleId } });
  }

  async deleteByVehicleId(vehicleId: string): Promise<boolean> {
    const result = await this.db.vehicleReportToken.deleteMany({ where: { vehicleId } });
    return result.count > 0;
  }

  async findByToken(token: string): Promise<VehicleReportToken | null> {
    return this.db.vehicleReportToken.findUnique({ where: { token } });
  }

  async findByVehicleId(vehicleId: string): Promise<VehicleReportToken | null> {
    return this.db.vehicleReportToken.findUnique({ where: { vehicleId } });
  }

  async findPrintoutByToken(token: string): Promise<MechanicPrintout | null> {
    const row = await this.db.vehicleReportToken.findUnique({
      where: { token },
      include: {
        vehicle: {
          include: {
            logEntries: {
              orderBy: { date: 'desc' },
              include: {
                items: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!row) return null;

    const { vehicle } = row;

    const logEntries: PrintoutLogEntry[] = vehicle.logEntries.map((entry) => ({
      id: entry.id,
      typeId: entry.typeId,
      title: entry.title,
      date: dateToIso(entry.date),
      mileage: entry.mileage,
      notes: entry.notes,
      items: entry.items.map((item) => ({
        categoryId: item.categoryId,
        description: item.description,
        quantity: item.quantity != null ? String(item.quantity) : null,
        unitCost: item.unitCost != null ? String(item.unitCost) : null,
      })),
    }));

    const allLineCosts = vehicle.logEntries.flatMap((e) =>
      e.items
        .filter((i) => i.quantity != null && i.unitCost != null)
        .map((i) => Number(i.quantity) * Number(i.unitCost)),
    );
    const totalSpent =
      allLineCosts.length > 0 ? allLineCosts.reduce((a, b) => a + b, 0).toFixed(2) : '0.00';

    const firstEntry = vehicle.logEntries[0];
    const lastLoggedAt = firstEntry ? dateToIso(firstEntry.date) : null;

    return {
      vehicle: {
        nickname: vehicle.nickname,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        mileage: vehicle.mileage,
        photoUrl: vehicle.photoPath,
      },
      stats: {
        logEntryCount: vehicle.logEntries.length,
        lastLoggedAt,
        totalSpent,
      },
      logEntries,
    };
  }
}
