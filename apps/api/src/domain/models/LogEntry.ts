export interface LogEntryItem {
  id: string;
  categoryId: string;
  description: string;
  quantity: string | null; // decimal as string
  unitCost: string | null; // decimal as string
  totalCost: string | null; // quantity * unitCost, or null
  sortOrder: number;
}

export interface LogEntryMedia {
  id: string;
  path: string;
  mediaType: 'IMAGE' | 'VIDEO';
  caption: string | null;
  sortOrder: number;
}

export interface LogEntry {
  id: string;
  vehicleId: string;
  typeId: string;
  title: string;
  date: string; // "YYYY-MM-DD"
  time: string | null; // "HH:mm"
  mileage: number | null;
  notes: string | null;
  items: LogEntryItem[];
  media: LogEntryMedia[];
  totalCost: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogEntrySummary {
  id: string;
  typeId: string;
  title: string;
  date: string;
  time: string | null;
  mileage: number | null;
  itemCount: number;
  mediaCount: number;
  totalCost: string | null;
}

export interface CreateLogEntryData {
  typeId: string;
  title: string;
  date: string;
  time?: string | null;
  mileage?: number | null;
  notes?: string | null;
  items: Array<{
    categoryId: string;
    description: string;
    quantity?: number | null;
    unitCost?: number | null;
    sortOrder?: number;
  }>;
  media: Array<{
    path: string;
    mediaType: 'IMAGE' | 'VIDEO';
    caption?: string | null;
    sortOrder?: number;
  }>;
}

export type UpdateLogEntryData = Partial<CreateLogEntryData>;
