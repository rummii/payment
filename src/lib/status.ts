// Computed billing state — the source of truth for UI badges and countdowns.
// The DB `status` column is a persisted cache that is refreshed from here.

import { DAY_MS, daysBetween } from "./dates";
import { SubStatus } from "./constants";

export type DisplayStatus =
  | "TRIAL"
  | "PAID"
  | "DUE"
  | "OVERDUE"
  | "FREE_ACTIVE"
  | "CANCELLED";

export interface MinimalSubscription {
  status: string;
  cycleStart: Date;
  billingCycleEnd: Date;
  trialEndsAt: Date | null;
}

export interface MinimalPlan {
  isFree: boolean;
}

export interface MinimalPayment {
  status: string;
  paymentDate: Date | null;
}

export interface DisplayState {
  status: DisplayStatus;
  paidThisCycle: boolean;
  /** Whole PH-calendar days from now to billingCycleEnd (negative = overdue). */
  daysUntilEnd: number;
  /** Present while status is TRIAL. */
  daysUntilTrialEnd: number | null;
}

/** A PAID payment whose date falls inside the subscription's current window. */
export function isPaidForCurrentCycle(
  payments: MinimalPayment[],
  sub: MinimalSubscription
): boolean {
  const start = sub.cycleStart.getTime() - DAY_MS; // tolerate tz edge cases
  const end = sub.billingCycleEnd.getTime() + DAY_MS;
  return payments.some(
    (p) =>
      p.status === "PAID" &&
      p.paymentDate !== null &&
      p.paymentDate.getTime() >= start &&
      p.paymentDate.getTime() <= end
  );
}

export function computeDisplayState(
  sub: MinimalSubscription,
  plan: MinimalPlan,
  payments: MinimalPayment[],
  now: Date = new Date()
): DisplayState {
  const daysUntilEnd = daysBetween(now, sub.billingCycleEnd);

  if (sub.status === SubStatus.CANCELLED) {
    return { status: "CANCELLED", paidThisCycle: false, daysUntilEnd, daysUntilTrialEnd: null };
  }

  if (plan.isFree) {
    return { status: "FREE_ACTIVE", paidThisCycle: true, daysUntilEnd, daysUntilTrialEnd: null };
  }

  const onTrial =
    sub.status === SubStatus.TRIAL &&
    sub.trialEndsAt !== null &&
    sub.trialEndsAt.getTime() > now.getTime();
  if (onTrial) {
    return {
      status: "TRIAL",
      paidThisCycle: false,
      daysUntilEnd,
      daysUntilTrialEnd: daysBetween(now, sub.trialEndsAt as Date),
    };
  }

  if (isPaidForCurrentCycle(payments, sub)) {
    return { status: "PAID", paidThisCycle: true, daysUntilEnd, daysUntilTrialEnd: null };
  }

  return {
    status: daysUntilEnd < 0 ? "OVERDUE" : "DUE",
    paidThisCycle: false,
    daysUntilEnd,
    daysUntilTrialEnd: null,
  };
}
