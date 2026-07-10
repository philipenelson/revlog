import type { CreateLogEntryInput, UpdateLogEntryInput } from '@maintenance-log/domain';
import type {
  LogEntryRepository,
  VehicleRepository,
  MetadataRepository,
  LogEntry,
  LogEntrySummary,
} from '../domain';
import { AppError } from '../middleware/error';
import { logger } from '../lib/logger';

export class LogEntryService {
  constructor(
    private readonly logEntryRepo: LogEntryRepository,
    private readonly vehicleRepo: VehicleRepository,
    private readonly metadataRepo: MetadataRepository,
  ) {}

  private async assertVehicleOwnership(vehicleId: string, accountId: string): Promise<void> {
    const vehicles = await this.vehicleRepo.findAllByAccountId(accountId);
    const owned = vehicles.some((v) => v.id === vehicleId);
    if (!owned) {
      // Not in the caller's garage: distinguish "no such vehicle" (404) from
      // "exists but belongs to another account" (403).
      const exists = await this.vehicleRepo.existsById(vehicleId);
      if (!exists) throw new AppError(404, 'Vehicle not found');
      throw new AppError(403, 'Forbidden');
    }
  }

  async create(vehicleId: string, accountId: string, input: CreateLogEntryInput): Promise<LogEntry> {
    await this.assertVehicleOwnership(vehicleId, accountId);

    const typeExists = await this.metadataRepo.logEntryTypeExists(input.typeId);
    if (!typeExists) throw new AppError(400, 'Invalid typeId');

    for (const item of input.items ?? []) {
      const catExists = await this.metadataRepo.itemCategoryExists(item.categoryId);
      if (!catExists) throw new AppError(400, `Invalid categoryId: ${item.categoryId}`);
    }

    const entry = await this.logEntryRepo.create(vehicleId, {
      ...input,
      items: (input.items ?? []).map((item) => ({
        ...item,
        quantity: item.quantity ?? null,
        unitCost: item.unitCost ?? null,
        sortOrder: item.sortOrder ?? 0,
      })),
      media: (input.media ?? []).map((m) => ({
        ...m,
        caption: m.caption ?? null,
        sortOrder: m.sortOrder ?? 0,
      })),
    });

    if (input.mileage != null) {
      await this.vehicleRepo.bumpMileageIfLower(vehicleId, input.mileage);
    }

    logger.info({ vehicleId, accountId, entryId: entry.id }, 'log entry created');
    return entry;
  }

  async list(vehicleId: string, accountId: string, typeId?: string): Promise<LogEntrySummary[]> {
    await this.assertVehicleOwnership(vehicleId, accountId);
    return this.logEntryRepo.findAllByVehicleId(vehicleId, typeId);
  }

  async getById(vehicleId: string, accountId: string, entryId: string): Promise<LogEntry> {
    await this.assertVehicleOwnership(vehicleId, accountId);
    const entry = await this.logEntryRepo.findById(vehicleId, entryId);
    if (!entry) throw new AppError(404, 'Log entry not found');
    return entry;
  }

  async update(
    vehicleId: string,
    accountId: string,
    entryId: string,
    input: UpdateLogEntryInput,
  ): Promise<LogEntry> {
    await this.assertVehicleOwnership(vehicleId, accountId);

    if (input.typeId !== undefined) {
      const typeExists = await this.metadataRepo.logEntryTypeExists(input.typeId);
      if (!typeExists) throw new AppError(400, 'Invalid typeId');
    }

    if (input.items !== undefined) {
      for (const item of input.items ?? []) {
        const catExists = await this.metadataRepo.itemCategoryExists(item.categoryId);
        if (!catExists) throw new AppError(400, `Invalid categoryId: ${item.categoryId}`);
      }
    }

    const entry = await this.logEntryRepo.update(vehicleId, entryId, {
      ...input,
      items:
        input.items !== undefined
          ? input.items.map((item) => ({
              ...item,
              quantity: item.quantity ?? null,
              unitCost: item.unitCost ?? null,
              sortOrder: item.sortOrder ?? 0,
            }))
          : undefined,
      media:
        input.media !== undefined
          ? input.media.map((m) => ({
              ...m,
              caption: m.caption ?? null,
              sortOrder: m.sortOrder ?? 0,
            }))
          : undefined,
    });

    if (!entry) throw new AppError(404, 'Log entry not found');

    if (input.mileage != null) {
      await this.vehicleRepo.bumpMileageIfLower(vehicleId, input.mileage);
    }

    logger.info({ vehicleId, accountId, entryId }, 'log entry updated');
    return entry;
  }

  async delete(vehicleId: string, accountId: string, entryId: string): Promise<void> {
    await this.assertVehicleOwnership(vehicleId, accountId);
    const deleted = await this.logEntryRepo.delete(vehicleId, entryId);
    if (!deleted) throw new AppError(404, 'Log entry not found');
    logger.info({ vehicleId, accountId, entryId }, 'log entry deleted');
  }
}
