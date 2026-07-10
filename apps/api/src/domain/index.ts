// The API's private domain layer (ADR 0039): rich entity models + repository
// (driven) port interfaces. Framework-free — imports only the shared contract
// package (@maintenance-log/domain: Zod schemas, *Input types, lookup constants).
// Not shared with web/mobile; those consume the API's wire contract via api-client.

export * from './models/Account';
export * from './models/User';
export * from './models/Vehicle';
export * from './models/LogEntry';
export * from './models/VehicleTransfer';
export * from './models/VehicleReportToken';
export * from './models/RefreshToken';
export * from './models/NewsletterSubscriber';

export * from './ports/VehicleRepository';
export * from './ports/UserRepository';
export * from './ports/AccountRepository';
export * from './ports/LogEntryRepository';
export * from './ports/VehicleTransferRepository';
export * from './ports/VehicleReportTokenRepository';
export * from './ports/RefreshTokenRepository';
export * from './ports/NewsletterRepository';
export * from './ports/InsuranceRepository';
export * from './ports/MetadataRepository';
