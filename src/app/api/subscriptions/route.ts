import { getSessionClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeDisplayState } from "@/lib/status";
import { syncPersistedStatus } from "@/lib/paymentsService";

/**
 * The client's subscriptions with freshly computed billing state
 * (TRIAL / PAID / DUE / OVERDUE / FREE_ACTIVE) + countdown day diffs.
 * The computed status is lazily persisted back onto the cached column.
 */
export async function GET() {
  const client = await getSessionClient();
  if (!client) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await db.clientSubscription.findMany({
    where: { clientId: client.id },
    include: { plan: true, payments: true },
    orderBy: { createdAt: "asc" },
  });
  const now = new Date();

  const subscriptions = subs.map((sub) => {
    const state = computeDisplayState(sub, sub.plan, sub.payments, now);
    void syncPersistedStatus(sub.id, state.status).catch(() => {});
    return {
      id: sub.id,
      plan: {
        id: sub.plan.id,
        slug: sub.plan.slug,
        name: sub.plan.name,
        description: sub.plan.description,
        tier: sub.plan.tier,
        isFree: sub.plan.isFree,
      },
      amountCents: sub.amountCents,
      currency: sub.currency,
      billingCycle: sub.billingCycle,
      cycleStart: sub.cycleStart,
      billingCycleEnd: sub.billingCycleEnd,
      trialEndsAt: sub.trialEndsAt,
      status: state.status,
      paidThisCycle: state.paidThisCycle,
      daysUntilEnd: state.daysUntilEnd,
      daysUntilTrialEnd: state.daysUntilTrialEnd,
    };
  });

  return Response.json({ subscriptions, now: now.toISOString() });
}
