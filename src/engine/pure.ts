// Pure (DB-free) lifecycle decision functions — unit-tested in tests/.

import { SubStatus } from "../lib/constants";
import { isPaidForCurrentCycle } from "../lib/status";

export type TrialDecision = "KEEP_TRIAL" | "TO_FREE" | "TO_DUE";

export function resolveTrialTransition(
  sub: { status: string; trialEndsAt: Date | null },
  plan: { isFree: boolean },
  now: Date
): TrialDecision {
  if (sub.status !== SubStatus.TRIAL) return "KEEP_TRIAL";
  if (!sub.trialEndsAt || sub.trialEndsAt.getTime() > now.getTime()) {
    return "KEEP_TRIAL";
  }
  return plan.isFree ? "TO_FREE" : "TO_DUE";
}

export type OverdueDecision = "STAY" | "MARK_OVERDUE";

export function resolveOverdue(
  sub: {
    status: string;
    cycleStart: Date;
    billingCycleEnd: Date;
    trialEndsAt: Date | null;
  },
  plan: { isFree: boolean },
  payments: Array<{ status: string; paymentDate: Date | null }>,
  now: Date
): OverdueDecision {
  if (plan.isFree) return "STAY";
  if (
    sub.status === SubStatus.CANCELLED ||
    sub.status === SubStatus.OVERDUE
  ) {
    return "STAY";
  }
  if (sub.status === SubStatus.TRIAL) return "STAY";
  if (sub.trialEndsAt && sub.trialEndsAt.getTime() > now.getTime()) {
    return "STAY";
  }
  if (isPaidForCurrentCycle(payments, sub)) return "STAY";
  return sub.billingCycleEnd.getTime() < now.getTime() ? "MARK_OVERDUE" : "STAY";
}

export type OverdueAction = "FOLLOWUP" | "SUSPENSION" | null;

/** Overdue follow-up cadence: day 3/6/9, final suspension warning day 12. */
export function overdueAction(daysOverdue: number): OverdueAction {
  if (daysOverdue === 12) return "SUSPENSION";
  if (daysOverdue === 3 || daysOverdue === 6 || daysOverdue === 9) {
    return "FOLLOWUP";
  }
  return null;
}

export type RenewalAction = "RENEWAL_10" | "RENEWAL_3" | null;

/**
 * Renewal reminder trigger. For calendar-month cycles, "10 days until
 * billingCycleEnd" is exactly the spec's "last day of month − 10 days".
 */
export function renewalAction(daysUntilEnd: number): RenewalAction {
  if (daysUntilEnd === 10) return "RENEWAL_10";
  if (daysUntilEnd === 3) return "RENEWAL_3";
  return null;
}

export type TrialReminderAction = "TRIAL_EXPIRING_3" | "TRIAL_EXPIRING_1" | null;

export function trialReminderAction(
  daysUntilTrialEnd: number | null
): TrialReminderAction {
  if (daysUntilTrialEnd === 3) return "TRIAL_EXPIRING_3";
  if (daysUntilTrialEnd === 1) return "TRIAL_EXPIRING_1";
  return null;
}
