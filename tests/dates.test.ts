import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  daysBetween,
  endOfMonth,
  formatUtcDay,
  fromParts,
  lastDayOfMonthMinus10,
  periodKey,
  phDayKey,
  startOfMonth,
} from "@/lib/dates";

describe("endOfMonth / startOfMonth", () => {
  it("returns Sep 30 2026 for a September date", () => {
    const d = fromParts({ y: 2026, m: 9, d: 6 });
    expect(formatUtcDay(endOfMonth(d))).toBe("2026-09-30");
    expect(formatUtcDay(startOfMonth(d))).toBe("2026-09-01");
  });

  it("handles leap-year February", () => {
    expect(formatUtcDay(endOfMonth(fromParts({ y: 2024, m: 2, d: 10 })))).toBe("2024-02-29");
    expect(formatUtcDay(endOfMonth(fromParts({ y: 2026, m: 2, d: 10 })))).toBe("2026-02-28");
  });

  it("handles 30/31-day months", () => {
    expect(formatUtcDay(endOfMonth(fromParts({ y: 2026, m: 4, d: 2 })))).toBe("2026-04-30");
    expect(formatUtcDay(endOfMonth(fromParts({ y: 2026, m: 8, d: 31 })))).toBe("2026-08-31");
  });
});

describe("lastDayOfMonthMinus10 (spec trigger)", () => {
  it("Sep 2026 → Sep 20", () => {
    expect(formatUtcDay(lastDayOfMonthMinus10(fromParts({ y: 2026, m: 9, d: 6 })))).toBe("2026-09-20");
  });
  it("Aug 2026 (31 days) → Aug 21", () => {
    expect(formatUtcDay(lastDayOfMonthMinus10(fromParts({ y: 2026, m: 8, d: 15 })))).toBe("2026-08-21");
  });
  it("Feb 2024 (leap) → Feb 19", () => {
    expect(formatUtcDay(lastDayOfMonthMinus10(fromParts({ y: 2024, m: 2, d: 1 })))).toBe("2024-02-19");
  });
  it("Mar 2025 (31 days) → Mar 21", () => {
    expect(formatUtcDay(lastDayOfMonthMinus10(fromParts({ y: 2025, m: 3, d: 5 })))).toBe("2025-03-21");
  });
});

describe("addMonthsClamped", () => {
  it("clamps Jan 31 → Feb 28 (non-leap)", () => {
    expect(formatUtcDay(addMonthsClamped(fromParts({ y: 2026, m: 1, d: 31 }), 1))).toBe("2026-02-28");
  });
  it("clamps Jan 31 → Feb 29 (leap)", () => {
    expect(formatUtcDay(addMonthsClamped(fromParts({ y: 2024, m: 1, d: 31 }), 1))).toBe("2024-02-29");
  });
  it("advances 12 months for annual cycles", () => {
    expect(formatUtcDay(addMonthsClamped(fromParts({ y: 2026, m: 9, d: 15 }), 12))).toBe("2027-09-15");
  });
});

describe("daysBetween", () => {
  it("counts whole days forward and backward", () => {
    const a = fromParts({ y: 2026, m: 9, d: 20 });
    const b = fromParts({ y: 2026, m: 9, d: 30 });
    expect(daysBetween(a, b)).toBe(10);
    expect(daysBetween(b, a)).toBe(-10);
  });
  it("returns 0 for the same day", () => {
    const a = fromParts({ y: 2026, m: 9, d: 6 });
    expect(daysBetween(a, a)).toBe(0);
  });
});

describe("keys", () => {
  it("periodKey is YYYY-MM", () => {
    expect(periodKey(fromParts({ y: 2026, m: 9, d: 6 })) === "2026-09").toBe(true);
  });
  it("phDayKey formats the PH calendar day", () => {
    expect(phDayKey(new Date("2026-09-06T12:00:00Z"))).toBe("2026-09-06");
    // 2026-09-06T20:00Z is already Sep 7 in PH (UTC+8)
    expect(phDayKey(new Date("2026-09-06T20:00:00Z"))).toBe("2026-09-07");
  });
});
