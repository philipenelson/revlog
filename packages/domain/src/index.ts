// Shared contract package: the system-wide surface that web, mobile, and the API
// all agree on — Zod validation schemas, their inferred *Input types, and lookup
// constants/enums. NOT the API's entity models or repository ports: those are
// private to the API (apps/api/src/domain/) per ADR 0039.
// No framework dependencies. No UI. No infrastructure. No server-internal types.
// All apps import from here; nothing here imports from apps.

export * from './schemas/auth';
export * from './schemas/vehicle';
export * from './schemas/vehicle-transfer';
export * from './schemas/log-entry';
export * from './schemas/insurance';
export * from './schemas/newsletter';
export * from './schemas/report';
export * from './user';
export * from './account';
export * from './refresh-token';
export * from './vehicle';
export * from './vehicle-transfer';
export * from './log-entry';
export * from './lookup-constants';
export * from './newsletter';
export * from './vehicle-report';
