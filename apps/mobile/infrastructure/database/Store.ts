// Generic entity-store port (ADR 0026's 2026-07-02 update) — not named or
// shaped after a database. Filter/sort criteria are generic values the
// adapter interprets; nothing here presupposes SQL.
export interface StoreQueryOptions<T> {
  where?: Partial<T>;
  orderBy?: { field: keyof T; direction: 'asc' | 'desc' };
}

export interface Store<T extends { id: string }> {
  getAll(options?: StoreQueryOptions<T>): Promise<T[]>;
  save(record: T): Promise<void>;
  remove(id: string): Promise<void>;
  // Atomically replaces this collection's entire contents. The only
  // atomicity primitive this port offers — see ADR 0027's 2026-07-02 update
  // for why there is no generic cross-collection transaction() method.
  replaceAll(records: T[]): Promise<void>;
}
