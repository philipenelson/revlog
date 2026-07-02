import { and, asc, desc, eq } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Store, StoreQueryOptions } from './Store';
import type { DrizzleDb } from './openDatabase';

// A Drizzle table whose column properties line up with T's fields, so
// Store<T>'s generic where/orderBy can address them by key.
type EntityTable<T> = SQLiteTable & { [K in keyof T]: SQLiteColumn };

// expo-sqlite's Drizzle driver is synchronous under the hood; db.transaction()
// requires a synchronous callback (its return type is T, not Promise<T> —
// see ADR 0026's 2026-07-02 update on why there's no cross-collection
// transaction() on the port itself). .run()/.get()/.all() are the explicit
// synchronous terminal calls; outside a transaction, awaiting the query
// builder directly (Drizzle's QueryPromise) works the same way.
export function createSQLiteStore<T extends { id: string }>(db: DrizzleDb, table: EntityTable<T>): Store<T> {
  return {
    async getAll(options?: StoreQueryOptions<T>): Promise<T[]> {
      let query = db.select().from(table).$dynamic();

      if (options?.where) {
        const conditions = Object.entries(options.where).map(([field, value]) =>
          eq(table[field as keyof T], value),
        );
        if (conditions.length > 0) query = query.where(and(...conditions));
      }

      if (options?.orderBy) {
        const column = table[options.orderBy.field];
        query = query.orderBy(options.orderBy.direction === 'desc' ? desc(column) : asc(column));
      }

      return (await query) as T[];
    },

    async save(record: T): Promise<void> {
      // Drizzle infers .values()'s parameter type from `table`'s own column
      // definitions, which TypeScript can't structurally unify with the
      // generic T at this boundary even though they describe the same shape
      // at runtime — an unavoidable, narrowly-scoped cast here, not
      // elsewhere: this adapter's entire job is bridging a fully generic
      // port to one specific, strongly-typed table.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values = record as any;
      await db.insert(table).values(values).onConflictDoUpdate({ target: table.id, set: values });
    },

    async remove(id: string): Promise<void> {
      await db.delete(table).where(eq(table.id, id));
    },

    async replaceAll(records: T[]): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values = records as any[];
      db.transaction((tx) => {
        tx.delete(table).run();
        if (values.length > 0) {
          tx.insert(table).values(values).run();
        }
      });
    },
  };
}
