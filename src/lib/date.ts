/**
 * Day keys are plain "YYYY-MM-DD" strings so a day never shifts under a
 * timezone conversion. Everything in the app agrees on this format.
 */

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toDayKey(new Date());
}

export function shiftDay(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDayKey(dt);
}

export function yesterdayOf(dayKey: string): string {
  return shiftDay(dayKey, -1);
}

export function isValidDayKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function prettyDay(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Last `n` day keys ending at (and including) `end`, oldest first. */
export function lastNDays(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDay(end, -(n - 1 - i)));
}
