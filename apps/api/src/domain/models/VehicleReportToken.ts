export interface VehicleReportToken {
  id: string;
  vehicleId: string;
  token: string;
  createdAt: Date;
}

export interface PrintoutLogItem {
  categoryId: string;
  description: string;
  quantity: string | null;
  unitCost: string | null;
}

export interface PrintoutLogEntry {
  id: string;
  typeId: string;
  title: string;
  date: string;
  mileage: number | null;
  notes: string | null;
  items: PrintoutLogItem[];
}

export interface PrintoutVehicle {
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  photoUrl: string | null;
}

export interface PrintoutStats {
  logEntryCount: number;
  lastLoggedAt: string | null;
  totalSpent: string;
}

export interface MechanicPrintout {
  vehicle: PrintoutVehicle;
  stats: PrintoutStats;
  logEntries: PrintoutLogEntry[];
}
