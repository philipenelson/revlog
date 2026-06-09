import { PrismaClient } from '../generated/prisma/client';
import type {
  ILogEntryRepository,
  DomainLogEntry,
  DomainLogEntryItem,
  DomainLogEntryMedia,
  LogEntrySummary,
  CreateLogEntryData,
  UpdateLogEntryData,
} from '@maintenance-log/domain';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>;
type LogEntryDb = Pick<PrismaClient, 'logEntry' | 'logItem' | 'logMedia'>;

function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeTotalCost(items: Array<{ quantity: unknown; unitCost: unknown }>): string | null {
  let total = 0;
  let hasAny = false;
  for (const item of items) {
    const q = item.quantity != null ? Number(item.quantity) : null;
    const u = item.unitCost != null ? Number(item.unitCost) : null;
    if (q != null && u != null) {
      total += q * u;
      hasAny = true;
    }
  }
  return hasAny ? total.toFixed(2) : null;
}

function toItemDomain(item: {
  id: string;
  categoryId: string;
  description: string;
  quantity: unknown;
  unitCost: unknown;
  sortOrder: number;
}): DomainLogEntryItem {
  const q = item.quantity != null ? String(item.quantity) : null;
  const u = item.unitCost != null ? String(item.unitCost) : null;
  let totalCost: string | null = null;
  if (q != null && u != null) {
    totalCost = (Number(q) * Number(u)).toFixed(2);
  }
  return {
    id: item.id,
    categoryId: item.categoryId,
    description: item.description,
    quantity: q,
    unitCost: u,
    totalCost,
    sortOrder: item.sortOrder,
  };
}

function toMediaDomain(m: {
  id: string;
  path: string;
  mediaType: string;
  caption: string | null;
  sortOrder: number;
}): DomainLogEntryMedia {
  return {
    id: m.id,
    path: m.path,
    mediaType: m.mediaType as 'IMAGE' | 'VIDEO',
    caption: m.caption,
    sortOrder: m.sortOrder,
  };
}

function toEntryDomain(
  entry: {
    id: string;
    vehicleId: string;
    typeId: string;
    title: string;
    date: Date;
    time: string | null;
    mileage: number | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  items: DomainLogEntryItem[],
  media: DomainLogEntryMedia[],
): DomainLogEntry {
  return {
    id: entry.id,
    vehicleId: entry.vehicleId,
    typeId: entry.typeId,
    title: entry.title,
    date: dateToIso(entry.date),
    time: entry.time,
    mileage: entry.mileage,
    notes: entry.notes,
    items,
    media,
    totalCost: computeTotalCost(items.map((i) => ({ quantity: i.quantity, unitCost: i.unitCost }))),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export class PrismaLogEntryRepository implements ILogEntryRepository {
  constructor(private readonly db: LogEntryDb) {}

  async create(vehicleId: string, data: CreateLogEntryData): Promise<DomainLogEntry> {
    const entry = await this.db.logEntry.create({
      data: {
        vehicleId,
        typeId: data.typeId,
        title: data.title,
        date: new Date(data.date),
        time: data.time ?? null,
        mileage: data.mileage ?? null,
        notes: data.notes ?? null,
        items: {
          create: (data.items ?? []).map((item, idx) => ({
            categoryId: item.categoryId,
            description: item.description,
            quantity: item.quantity ?? null,
            unitCost: item.unitCost ?? null,
            sortOrder: item.sortOrder ?? idx,
          })),
        },
        media: {
          create: (data.media ?? []).map((m, idx) => ({
            path: m.path,
            mediaType: m.mediaType,
            caption: m.caption ?? null,
            sortOrder: m.sortOrder ?? idx,
          })),
        },
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        media: { orderBy: { sortOrder: 'asc' } },
      },
    });

    const items = entry.items.map(toItemDomain);
    const media = entry.media.map(toMediaDomain);
    return toEntryDomain(entry, items, media);
  }

  async findAllByVehicleId(vehicleId: string, typeId?: string): Promise<LogEntrySummary[]> {
    const entries = await this.db.logEntry.findMany({
      where: { vehicleId, ...(typeId ? { typeId } : {}) },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { items: true, media: true } },
        items: { select: { quantity: true, unitCost: true } },
      },
    });

    return entries.map((e) => ({
      id: e.id,
      typeId: e.typeId,
      title: e.title,
      date: dateToIso(e.date),
      time: e.time,
      mileage: e.mileage,
      itemCount: e._count.items,
      mediaCount: e._count.media,
      totalCost: computeTotalCost(e.items),
    }));
  }

  async findById(vehicleId: string, entryId: string): Promise<DomainLogEntry | null> {
    const entry = await this.db.logEntry.findFirst({
      where: { id: entryId, vehicleId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        media: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!entry) return null;

    const items = entry.items.map(toItemDomain);
    const media = entry.media.map(toMediaDomain);
    return toEntryDomain(entry, items, media);
  }

  async update(vehicleId: string, entryId: string, data: UpdateLogEntryData): Promise<DomainLogEntry | null> {
    // Verify the entry belongs to this vehicle
    const existing = await this.db.logEntry.findFirst({ where: { id: entryId, vehicleId } });
    if (!existing) return null;

    const scalarUpdate: Record<string, unknown> = {};
    if (data.typeId !== undefined) scalarUpdate['typeId'] = data.typeId;
    if (data.title !== undefined) scalarUpdate['title'] = data.title;
    if (data.date !== undefined) scalarUpdate['date'] = new Date(data.date);
    if (data.time !== undefined) scalarUpdate['time'] = data.time ?? null;
    if (data.mileage !== undefined) scalarUpdate['mileage'] = data.mileage ?? null;
    if (data.notes !== undefined) scalarUpdate['notes'] = data.notes ?? null;

    const result = await (this.db as PrismaClient).$transaction(async (tx: TransactionClient) => {
      const updated = await tx.logEntry.update({
        where: { id: entryId },
        data: scalarUpdate,
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
          media: { orderBy: { sortOrder: 'asc' } },
        },
      });

      if (data.items !== undefined) {
        await tx.logItem.deleteMany({ where: { logEntryId: entryId } });
        if (data.items.length > 0) {
          await tx.logItem.createMany({
            data: data.items.map((item, idx) => ({
              logEntryId: entryId,
              categoryId: item.categoryId,
              description: item.description,
              quantity: item.quantity ?? null,
              unitCost: item.unitCost ?? null,
              sortOrder: item.sortOrder ?? idx,
            })),
          });
        }
      }

      if (data.media !== undefined) {
        await tx.logMedia.deleteMany({ where: { logEntryId: entryId } });
        if (data.media.length > 0) {
          await tx.logMedia.createMany({
            data: data.media.map((m, idx) => ({
              logEntryId: entryId,
              path: m.path,
              mediaType: m.mediaType,
              caption: m.caption ?? null,
              sortOrder: m.sortOrder ?? idx,
            })),
          });
        }
      }

      // Re-fetch with updated relations
      const final = await tx.logEntry.findFirst({
        where: { id: entryId },
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
          media: { orderBy: { sortOrder: 'asc' } },
        },
      });

      return final ?? updated;
    });

    const items = result.items.map(toItemDomain);
    const media = result.media.map(toMediaDomain);
    return toEntryDomain(result, items, media);
  }

  async delete(vehicleId: string, entryId: string): Promise<boolean> {
    const existing = await this.db.logEntry.findFirst({ where: { id: entryId, vehicleId } });
    if (!existing) return false;
    await this.db.logEntry.delete({ where: { id: entryId } });
    return true;
  }
}
