// Cross-table atomic write port (ADR 0027's 2026-07-03 update): applies an
// entity change and enqueues an outbox entry in a single database
// transaction. Narrower than Store<T> — only entities with an offline write
// path need it, and Store<T> stays generic/SQL-agnostic for every other
// (single-collection) read/write in this app.
export interface OutboxWriter<T extends { id: string }> {
  save(record: T, outboxType: string, outboxPayload: unknown): Promise<void>;
  // Delete-path sibling of save() -- removes the row and enqueues an outbox
  // entry in the same transaction.
  remove(id: string, outboxType: string, outboxPayload: unknown): Promise<void>;
}
