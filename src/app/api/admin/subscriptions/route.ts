import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { computeDisplayState } from "@/lib/status";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const q = new URL(req.url).searchParams.get("query")?.trim().toLowerCase() ?? "";
  const subs = await db.clientSubscription.findMany({
    where: q
      ? {
          OR: [
            { client: { name: { contains: q } } },
            { client: { email: { contains: q } } },
            { plan: { name: { contains: q } } },
          ],
        }
      : undefined,
    include: { client: true, plan: true, payments: { where: { status: "PAID" } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const now = new Date();

  return Response.json({
    subscriptions: subs.map((s) => {
      const state = computeDisplayState(s, s.plan, s.payments, now);
      return {
        id: s.id,
        clientName: s.client.name,
        clientEmail: s.client.email,
        planName: s.plan.name,
        amountCents: s.amountCents,
        status: state.status,
        daysUntilEnd: state.daysUntilEnd,
        billingCycle: s.billingCycle,
        cycleStart: s.cycleStart,
        billingCycleEnd: s.billingCycleEnd,
        trialEndsAt: s.trialEndsAt,
        updatedAt: s.updatedAt,
      };
    }),
  });
}
