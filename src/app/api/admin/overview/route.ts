import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { computeDisplayState } from "@/lib/status";
import { startOfMonth } from "@/lib/dates";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const som = startOfMonth(now);

  const clients = await db.client.count();
  const subs = await db.clientSubscription.findMany({
    include: { plan: true, payments: { where: { status: "PAID" } } },
  });
  const collected = await db.payment.aggregate({
    where: { status: "PAID", paymentDate: { gte: som } },
    _sum: { amountCents: true },
    _count: true,
  });

  let dueTotalCents = 0;
  let overdueTotalCents = 0;
  let overdueCount = 0;
  let trialCount = 0;
  let activeCount = 0;
  for (const s of subs) {
    const st = computeDisplayState(s, s.plan, s.payments, now).status;
    if (st === "DUE") {
      dueTotalCents += s.amountCents;
      activeCount += 1;
    } else if (st === "OVERDUE") {
      overdueTotalCents += s.amountCents;
      overdueCount += 1;
    } else if (st === "TRIAL") {
      trialCount += 1;
      activeCount += 1;
    } else if (st === "PAID" || st === "FREE_ACTIVE") {
      activeCount += 1;
    }
  }

  const recent = await db.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      client: true,
      subscription: { include: { plan: true } },
    },
  });

  return Response.json({
    stats: {
      clients,
      subscriptions: subs.length,
      collectedThisMonthCents: collected._sum.amountCents ?? 0,
      paymentsThisMonth: collected._count,
      dueTotalCents,
      overdueTotalCents,
      overdueCount,
      trialCount,
      activeCount,
    },
    recentPayments: recent.map((p) => ({
      ref: p.transactionRef,
      client: p.client.name,
      plan: p.subscription.plan.name,
      method: p.method,
      provider: p.provider,
      amountCents: p.amountCents,
      status: p.status,
      paymentDate: p.paymentDate,
      createdAt: p.createdAt,
    })),
  });
}
