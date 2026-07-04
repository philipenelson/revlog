/** Today's date as "YYYY-MM-DD", using local date components (not UTC). */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/** A Date -> "YYYY-MM-DD", using local date components (not UTC). */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** "YYYY-MM-DD" -> a local Date at midnight (matches utils/format.ts's formatShortDate parsing). */
export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}
