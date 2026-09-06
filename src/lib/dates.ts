// Calendar-date math for the Philippine (PHT, UTC+8, no DST) billing calendar.
//
// Convention: a "calendar date" is represented as a Date at UTC midnight
// corresponding to that PH calendar day. Any instant passed in is first
// converted to its PH calendar day. Billing cycles align to calendar months
// per the product spec (monthly due = last day of the current month).

export const PH_TZ = "Asia/Manila";
export const DAY_MS = 86_400_000;

export interface Ymd {
  y: number;
  m: number; // 1-based
  d: number;
}

/** Calendar day (in PH time) of any instant. */
export function phDateParts(d: Date = new Date()): Ymd {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, day] = fmt.format(d).split("-").map(Number);
  return { y, m, d: day };
}

/** UTC-midnight Date representing the PH calendar day of `d`. */
export function toPhUtcMidnight(d: Date): Date {
  const p = phDateParts(d);
  return utcDate(p.y, p.m, p.d);
}

export function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

export function fromParts(p: Ymd): Date {
  return utcDate(p.y, p.m, p.d);
}

/** Current instant (alias for readability in engine code). */
export function phNow(): Date {
  return new Date();
}

/** 'YYYY-MM-DD' PH calendar-day key. */
export function phDayKey(d: Date = new Date()): string {
  const p = phDateParts(d);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** 'YYYY-MM' PH calendar key (reminder dedupe period). */
export function periodKey(d: Date = new Date()): string {
  const p = phDateParts(d);
  return `${p.y}-${String(p.m).padStart(2, "0")}`;
}

export function isSamePhDay(a: Date, b: Date): boolean {
  return toPhUtcMidnight(a).getTime() === toPhUtcMidnight(b).getTime();
}

/** First day (PH calendar) of the month containing `date`. */
export function startOfMonth(date: Date): Date {
  const b = toPhUtcMidnight(date);
  return utcDate(b.getUTCFullYear(), b.getUTCMonth() + 1, 1);
}

/** Last day (PH calendar) of the month containing `date` — the monthly due date. */
export function endOfMonth(date: Date): Date {
  const b = toPhUtcMidnight(date);
  const last = new Date(
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return utcDate(b.getUTCFullYear(), b.getUTCMonth() + 1, last);
}

/** Add months, clamping day-of-month (Jan 31 + 1mo → Feb 28/29). */
export function addMonthsClamped(date: Date, months: number): Date {
  const b = toPhUtcMidnight(date);
  const target = new Date(
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + months, 1)
  );
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return utcDate(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    Math.min(b.getUTCDate(), last)
  );
}

export function minusDays(date: Date, n: number): Date {
  return new Date(toPhUtcMidnight(date).getTime() - n * DAY_MS);
}

export function plusDays(date: Date, n: number): Date {
  return minusDays(date, -n);
}

/**
 * The spec's reminder target: 10 days prior to the last day of the current
 * month (e.g. Sep 30 → Sep 20; Aug 31 → Aug 21).
 */
export function lastDayOfMonthMinus10(date: Date): Date {
  return minusDays(endOfMonth(date), 10);
}

/** Whole days from `a` to `b` on the PH calendar (negative if b is before a). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round(
    (toPhUtcMidnight(b).getTime() - toPhUtcMidnight(a).getTime()) / DAY_MS
  );
}

export function formatUtcDay(date: Date): string {
  const b = toPhUtcMidnight(date);
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, "0")}-${String(b.getUTCDate()).padStart(2, "0")}`;
}

export function formatPhDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
