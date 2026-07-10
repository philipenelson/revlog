// Reference-data (seeded lookup tables) existence checks. Lets the application
// validate a LogEntry's typeId / item categoryId without reaching for Prisma —
// ADR 0039 (keeps the application layer framework-free). Named "Metadata"
// rather than "Lookup": it validates reference data, distinct from the public
// reference-data endpoint served by the http/routers lookup router.
export interface MetadataRepository {
  logEntryTypeExists(id: string): Promise<boolean>;
  itemCategoryExists(id: string): Promise<boolean>;
}
