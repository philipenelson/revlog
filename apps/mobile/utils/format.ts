// Mirrors apps/web/src/utils/format.ts so mobile and web render Vehicle
// Detail's stats/dates/currency identically.

/** "2026-05-15" → "May 15, 2026" (parsed as a local date, not UTC). */
export function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** 1234.5 → "$1,235" — whole-dollar display for stat tiles. */
export function formatCurrencyWhole(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
