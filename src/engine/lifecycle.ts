// Lifecycle automation — trial transitions and overdue sweeps. Runs inside
// the daily job (and can be invoked via the cron route).

import { db } from "../lib/db";
import { Events, SubStatus } from "../lib/constants";
import { resolveOverdue, resolveTrialTransition } from "./pure";
import { publishEvent } from "./webhooks";
import { dispatchEmail } from "../notifications/dispatch";
import { buildTrialExpiredEmail } from "../notifications/templates";

export interface LifecycleSummary {
  trialsExpired: number;
  overdueMarked: number;
}

export async function runLifecycle(now: Date = new Date()): Promise<LifecycleSummary> {
  const subs = await db.clientSubscription.findMany({
    include: { plan: true, client: true, payments: { where: { status: "PAID" } } },
  });
  let trialsExpired = 0;
  let overdueMarked = 0;

  for (const sub of subs) {
    // 1) Trial → FREE-ACTIVE or DUE once trialEndsAt passes.
    const trial = resolveTrialTransition(sub, sub.plan, now);
    if (trial !== "KEEP_TRIAL") {
      await db.clientSubscription.update({
        where: { id: sub.id },
        data: { status: trial === "TO_FREE" ? SubStatus.ACTIVE : SubStatus.DUE },
      });
      trialsExpired += 1;
      await publishEvent(Events.TRIAL_EXPIRED, {
        subscriptionId: sub.id,
        planSlug: sub.plan.slug,
        converted: trial === "TO_DUE",
      });
      if (trial === "TO_DUE") {
        await dispatchEmail({
          clientId: sub.clientId,
          to: sub.client.email,
          subject: `Your ${sub.plan.name} trial has ended`,
          html: buildTrialExpiredEmail({
            clientName: sub.client.name,
            planName: sub.plan.name,
            amountCents: sub.amountCents,
          }).html,
          text: buildTrialExpiredEmail({
            clientName: sub.client.name,
            planName: sub.plan.name,
            amountCents: sub.amountCents,
          }).text,
        });
      }
      continue;
    }

    // 2) Unpaid, non-trial cycles past their end date → OVERDUE.
    const decision = resolveOverdue(sub, sub.plan, sub.payments, now);
    if (decision === "MARK_OVERDUE") {
      await db.clientSubscription.update({
        where: { id: sub.id },
        data: { status: SubStatus.OVERDUE },
      });
      overdueMarked += 1;
      await publishEvent(Events.SUBSCRIPTION_OVERDUE, {
        subscriptionId: sub.id,
        planSlug: sub.plan.slug,
        overdueSince: sub.billingCycleEnd.toISOString(),
      });
    }
  }

  return { trialsExpired, overdueMarked };
}
