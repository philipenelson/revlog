export const LOG_ENTRY_TYPE = {
  MAINTENANCE:  'MAINTENANCE',
  REPAIR:       'REPAIR',
  INSPECTION:   'INSPECTION',
  MODIFICATION: 'MODIFICATION',
  INCIDENT:     'INCIDENT',
  EVENT:        'EVENT',
  OTHER:        'OTHER',
} as const;

export type LogEntryTypeId = typeof LOG_ENTRY_TYPE[keyof typeof LOG_ENTRY_TYPE];

export const ITEM_CATEGORY = {
  PART:  'PART',
  LABOR: 'LABOR',
  FEE:   'FEE',
  OTHER: 'OTHER',
} as const;

export type ItemCategoryId = typeof ITEM_CATEGORY[keyof typeof ITEM_CATEGORY];
