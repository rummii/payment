import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { BillingCycle, PlanTier } from "@/lib/constants";
import type { PlanTierValue } from "@/lib/constants";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const plans = await db.plan.findMany({
    orderBy: { createdAt: "asc" },
  });
  const counts = await db.clientSubscription.groupBy({
    by: ["planId"],
    _count: true,
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.planId, c._count]));

  return Response.json({
    plans: plans.map((p) => ({
      ...p,
      subscriptionCount: countMap[p.id] ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    slug?: string;
    name?: string;
    description?: string;
    tier?: string;
    defaultAmountCents?: number;
    billingCycle?: string;
    trialDays?: number;
    isFree?: boolean;
  } | null;

  const slug = String(body?.slug ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();
  if (!slug || !name || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.json(
      { error: "Valid slug (a-z, 0-9, dashes) and name are required" },
      { status: 400 }
    );
  }
  const exists = await db.plan.findUnique({ where: { slug } });
  if (exists) {
    return Response.json({ error: "A plan with that slug exists" }, { status: 409 });
  }

  const plan = await db.plan.create({
    data: {
      slug,
      name,
      description: body?.description?.trim() || null,
      tier: Object.values(PlanTier).includes(body?.tier as PlanTierValue)
        ? (body?.tier as string)
        : PlanTier.STARTER,
      defaultAmountCents: Math.max(0, Math.round(body?.defaultAmountCents ?? 0)),
      billingCycle:
        body?.billingCycle === BillingCycle.ANNUAL
          ? BillingCycle.ANNUAL
          : BillingCycle.MONTHLY,
      trialDays: Math.max(0, Math.round(body?.trialDays ?? 0)),
      isFree: Boolean(body?.isFree),
    },
  });
  return Response.json({ plan }, { status: 201 });
}
