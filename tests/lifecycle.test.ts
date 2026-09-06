import { describe, expect, it } from "vitest";
import {
  overdueAction,
  renewalAction,
  resolveOverdue,
  resolveTrialTransition,
  trialReminderAction,
} from "@/engine/pure";
import { fromParts } from "@/lib/dates";

const now = fromParts({ y: 2026, m: 9, d: 6 });

describe("resolveTrialTransition", () => {
  it("keeps an active trial", () => {
    const d = resolveTrialTransition(
      { status: "TRIAL", trialEndsAt: fromParts({ y: 2026, m: 9, d: 15 }) },
      { isFree: false },
      now
    );
    expect(d).toBe("KEEP_TRIAL");
  });

  it("converts an expired paid-plan trial to DUE", () => {
    const d = resolveTrialTransition(
      { status: "TRIAL", trialEndsAt: fromParts({ y: 2026, m: 9, d: 5 }) },
      { isFree: false },
      now
    );
    expect(d).toBe("TO_DUE");
  });

  it("moves an expired free-plan trial to FREE-ACTIVE", () => {
    const d = resolveTrialTransition(
      { status: "TRIAL", trialEndsAt: fromParts({ y: 2026, m: 9, d: 5 }) },
      { isFree: true },
      now
    );
    expect(d).toBe("TO_FREE");
  });

  it("ignores non-trial subscriptions", () => {
    const d = resolveTrialTransition(
      { status: "DUE", trialEndsAt: fromParts({ y: 2026, m: 9, d: 5 }) },
      { isFree: false },
      now
    );
    expect(d).toBe("KEEP_TRIAL");
  });
});

describe("resolveOverdue", () => {
  const pastEnd = {
    status: "DUE",
    cycleStart: fromParts({ y: 2026, m: 8, d: 1 }),
    billingCycleEnd: fromParts({ y: 2026, m: 8, d: 31 }),
    trialEndsAt: null,
  } as const;

  it("marks unpaid past-end subscriptions OVERDUE", () => {
    expect(resolveOverdue(pastEnd, { isFree: false }, [], now)).toBe("MARK_OVERDUE");
  });

  it("stays for settled cycles", () => {
    const payments = [
      { status: "PAID", paymentDate: fromParts({ y: 2026, m: 8, d: 15 }) },
    ];
    expect(resolveOverdue(pastEnd, { isFree: false }, payments, now)).toBe("STAY");
  });

  it("never marks free tiers", () => {
    expect(resolveOverdue(pastEnd, { isFree: true }, [], now)).toBe("STAY");
  });

  it("never marks active trials", () => {
    expect(
      resolveOverdue(
        { status: "TRIAL", cycleStart: pastEnd.cycleStart, billingCycleEnd: pastEnd.billingCycleEnd, trialEndsAt: fromParts({ y: 2026, m: 9, d: 15 }) },
        { isFree: false },
        [],
        now
      )
    ).toBe("STAY");
  });
});

describe("rule day selectors", () => {
  it("fires the spec renewal rule exactly at T-10 days", () => {
    expect(renewalAction(10)).toBe("RENEWAL_10");
    expect(renewalAction(11)).toBeNull();
    expect(renewalAction(9)).toBeNull();
    expect(renewalAction(3)).toBe("RENEWAL_3");
  });

  it("fires trial reminders at T-3 and T-1", () => {
    expect(trialReminderAction(3)).toBe("TRIAL_EXPIRING_3");
    expect(trialReminderAction(1)).toBe("TRIAL_EXPIRING_1");
    expect(trialReminderAction(2)).toBeNull();
    expect(trialReminderAction(null)).toBeNull();
  });

  it("sends overdue follow-ups on days 3/6/9 and final warning on 12", () => {
    expect(overdueAction(3)).toBe("FOLLOWUP");
    expect(overdueAction(6)).toBe("FOLLOWUP");
    expect(overdueAction(9)).toBe("FOLLOWUP");
    expect(overdueAction(12)).toBe("SUSPENSION");
    expect(overdueAction(4)).toBeNull();
    expect(overdueAction(20)).toBeNull();
  });
});
