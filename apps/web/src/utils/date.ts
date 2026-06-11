/** Today's date as "YYYY-MM-DD". */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True when `isoDate` is between now and 30 days from now (inclusive). */
export function isWithin30Days(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(year, month - 1, day).getTime();
  const now = Date.now();
  const diffDays = (target - now) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 30;
}
