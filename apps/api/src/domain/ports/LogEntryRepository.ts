import type {
  LogEntry,
  LogEntrySummary,
  CreateLogEntryData,
  UpdateLogEntryData,
} from '../models/LogEntry';

export interface LogEntryRepository {
  create(vehicleId: string, data: CreateLogEntryData): Promise<LogEntry>;
  findAllByVehicleId(vehicleId: string, typeId?: string): Promise<LogEntrySummary[]>;
  findById(vehicleId: string, entryId: string): Promise<LogEntry | null>;
  update(vehicleId: string, entryId: string, data: UpdateLogEntryData): Promise<LogEntry | null>;
  delete(vehicleId: string, entryId: string): Promise<boolean>;
}
