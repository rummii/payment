import { describe, expect, it } from "vitest";
import { computeDisplayState, isPaidForCurrentCycle } from "@/lib/status";
import type { MinimalPayment, MinimalPlan, MinimalSubscription } from "@/lib/status";
import { fromParts } from "@/lib/dates";

const planFree: MinimalPlan = { isFree: true };
const planPaid: MinimalPlan = { isFree: false };

function sub(overrides: Partial<MinimalSubscription> = {}): MinimalSubscription {
  return {
    status: "DUE",
    cycleStart: fromParts({ y: 2026, m: 9, d: 1 }),
    billingCycleEnd: fromParts({ y: 2026, m: 9, d: 30 }),
    trialEndsAt: null,
    ...overrides,
  };
}

function paid(partial: Partial<MinimalPayment> = {}): MinimalPayment {
  return { status: "PAID", paymentDate: fromParts({ y: 2026, m: 9, d: 10 }), ...partial };
}

describe("isPaidForCurrentCycle", () => {
  it("matches a PAID payment inside the cycle window", () => {
    const s = sub();
    expect(isPaidForCurrentCycle([paid()], s)).toBe(true);
  });
  it("ignores PAID payments from the previous cycle", () => {
    const s = sub();
    expect(
      isPaidForCurrentCycle(
        [paid({ paymentDate: fromParts({ y: 2026, m: 8, d: 20 }) })],
        s
      )
    ).toBe(false);
  });
  it("ignores non-PAID payments", () => {
    expect(isPaidForCurrentCycle([paid({ status: "PENDING" })], sub())).toBe(false);
  });
});

describe("computeDisplayState", () => {
  const now = fromParts({ y: 2026, m: 9, d: 20 });

  it("is PAID when the cycle has a settled payment", () => {
    const state = computeDisplayState(sub(), planPaid, [paid()], now);
    expect(state.status).toBe("PAID");
    expect(state.paidThisCycle).toBe(true);
  });

  it("is DUE when unpaid with days remaining", () => {
    const state = computeDisplayState(sub(), planPaid, [], now);
    expect(state.status).toBe("DUE");
    expect(state.daysUntilEnd).toBe(10);
  });

  it("is OVERDUE once the cycle end has passed", () => {
    const s = sub({
      cycleStart: fromParts({ y: 2026, m: 8, d: 1 }),
      billingCycleEnd: fromParts({ y: 2026, m: 8, d: 31 }),
    });
    const state = computeDisplayState(s, planPaid, [], now);
    expect(state.status).toBe("OVERDUE");
    expect(state.daysUntilEnd).toBe(-20);
  });

  it("is TRIAL while trialEndsAt is in the future (even if unpaid)", () => {
    const s = sub({ status: "TRIAL", trialEndsAt: fromParts({ y: 2026, m: 9, d: 29 }) });
    const state = computeDisplayState(s, planPaid, [], now);
    expect(state.status).toBe("TRIAL");
    expect(state.daysUntilTrialEnd).toBe(9);
  });

  it("falls through to DUE after the trial expired", () => {
    const s = sub({ status: "TRIAL", trialEndsAt: fromParts({ y: 2026, m: 9, d: 10 }) });
    const state = computeDisplayState(s, planPaid, [], now);
    expect(state.status).toBe("DUE");
  });

  it("FREE plans never show as due", () => {
    const state = computeDisplayState(sub({ status: "ACTIVE" }), planFree, [], now);
    expect(state.status).toBe("FREE_ACTIVE");
    expect(state.paidThisCycle).toBe(true);
  });

  it("CANCELLED stays cancelled", () => {
    const state = computeDisplayState(sub({ status: "CANCELLED" }), planPaid, [], now);
    expect(state.status).toBe("CANCELLED");
  });
});
