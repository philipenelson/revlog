// Shared account contract enums (ADR 0039). The Account entity model and its
// repository port are private to the API (apps/api/src/domain/); only these
// wire-level enums are agreed system-wide (web/mobile/api-client consume them).
export type AccountType = 'PERSONAL';

export type AccountStatus = 'ONBOARDING' | 'ACTIVE';
